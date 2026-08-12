import json
import os
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

import boto3
from boto3.dynamodb.conditions import Key

from config import (
    DYNAMODB_BATTERY_TABLE_NAME,
    DYNAMODB_MOISTURE_TABLE_NAME,
    THING_NAME,
)

_dynamodb = boto3.resource("dynamodb")
_moisture_table = _dynamodb.Table(DYNAMODB_MOISTURE_TABLE_NAME)
_battery_table = _dynamodb.Table(DYNAMODB_BATTERY_TABLE_NAME)

_SUPPORTED_METRICS = {
    "moisture": ("moisture", _moisture_table),
    "battery_pct": ("battery_pct", _battery_table),
    "battery_mv": ("battery_mv", _battery_table),
}


def _now_utc() -> datetime:
    return datetime.now(tz=timezone.utc)


def _parse_epoch_ms(raw: Optional[str], fallback: datetime) -> datetime:
    if raw is None:
        return fallback
    try:
        return datetime.fromtimestamp(int(raw) / 1000.0, tz=timezone.utc)
    except (TypeError, ValueError):
        raise ValueError("from_ms/to_ms must be epoch milliseconds")


def _iso_utc(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _to_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _response(status_code: int, body: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
        },
        "body": json.dumps(body, ensure_ascii=False),
    }


def _extract_query_params(event: Dict[str, Any]) -> Dict[str, str]:
    query = event.get("queryStringParameters")
    if isinstance(query, dict):
        return {k: v for k, v in query.items() if v is not None}
    return {}


def _validate_api_key(event: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    expected = os.environ.get("GRAFANA_API_KEY")
    if not expected:
        return True, None

    headers = event.get("headers") or {}
    presented = headers.get("x-api-key") or headers.get("X-API-Key")
    if presented != expected:
        return False, "unauthorized"
    return True, None


def _query_series(
    thing_name: str,
    metric_name: str,
    start_iso: str,
    end_iso: str,
    limit: int,
) -> List[Dict[str, Any]]:
    metric_field, table = _SUPPORTED_METRICS[metric_name]

    result = table.query(
        KeyConditionExpression=Key("thing_name").eq(thing_name)
        & Key("timestamp").between(start_iso, end_iso),
        ScanIndexForward=True,
        Limit=limit,
    )

    points: List[Dict[str, Any]] = []
    for item in result.get("Items", []):
        raw_val = _to_float(item.get(metric_field))
        if raw_val is None:
            continue
        ts = item.get("timestamp")
        if not ts:
            continue
        points.append({"time": ts, "value": raw_val})

    return points


def lambda_handler(event, context):
    ok, err = _validate_api_key(event)
    if not ok:
        return _response(401, {"message": err})

    try:
        params = _extract_query_params(event)

        metric = params.get("metric", "moisture")
        if metric not in _SUPPORTED_METRICS:
            return _response(
                400,
                {
                    "message": "unsupported metric",
                    "supported_metrics": sorted(_SUPPORTED_METRICS.keys()),
                },
            )

        thing_name = params.get("thing_name", THING_NAME)

        now = _now_utc()
        default_from = now - timedelta(hours=24)
        from_dt = _parse_epoch_ms(params.get("from_ms"), default_from)
        to_dt = _parse_epoch_ms(params.get("to_ms"), now)

        if from_dt > to_dt:
            return _response(400, {"message": "from_ms must be <= to_ms"})

        try:
            limit = int(params.get("limit", "1000"))
        except ValueError:
            return _response(400, {"message": "limit must be an integer"})
        limit = max(1, min(limit, 5000))

        from_iso = _iso_utc(from_dt)
        to_iso = _iso_utc(to_dt)

        series = _query_series(thing_name, metric, from_iso, to_iso, limit)

        return _response(
            200,
            {
                "thing_name": thing_name,
                "metric": metric,
                "from": from_iso,
                "to": to_iso,
                "count": len(series),
                "series": series,
            },
        )
    except ValueError as exc:
        return _response(400, {"message": str(exc)})
    except Exception as exc:  # pragma: no cover
        print(f"Unhandled error: {exc}")
        return _response(500, {"message": "internal server error"})
