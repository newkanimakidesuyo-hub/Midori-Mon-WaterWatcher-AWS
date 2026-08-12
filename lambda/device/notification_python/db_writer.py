from datetime import datetime, timezone
from typing import Any, Dict, Optional

import boto3

from config import DYNAMODB_BATTERY_TABLE_NAME, DYNAMODB_MOISTURE_TABLE_NAME, DYNAMODB_TEMPERATURE_TABLE_NAME

_dynamodb = boto3.resource("dynamodb")
_moisture_table = _dynamodb.Table(DYNAMODB_MOISTURE_TABLE_NAME)
_battery_table = _dynamodb.Table(DYNAMODB_BATTERY_TABLE_NAME)
_temperature_table = _dynamodb.Table(DYNAMODB_TEMPERATURE_TABLE_NAME)


def _utc_timestamp() -> str:
    now = datetime.now(tz=timezone.utc)
    return now.strftime("%Y-%m-%dT%H:%M:%SZ")


def write_moisture_data(
    thing_name: str,
    moisture: Optional[int],
    result: Optional[bool],
    alerted: bool,
) -> None:
    """Write one row to Midori-Mon-WaterWatcher-DB-MoistureSensor."""
    timestamp = _utc_timestamp()

    item = {
        "thing_name": thing_name,
        "timestamp": timestamp,
        "alerted": alerted,
    }

    if moisture is not None:
        item["moisture"] = moisture
    if result is not None:
        item["result"] = result

    _moisture_table.put_item(Item=item)
    print(f"DynamoDB moisture write OK: thing_name={thing_name}, timestamp={timestamp}")


def write_battery_data(thing_name: str, battery: Optional[Dict[str, Any]]) -> None:
    """Write one row to Midori-Mon-WaterWatcher-DB-DeviceBattery."""
    if not isinstance(battery, dict):
        return

    timestamp = _utc_timestamp()

    item = {
        "thing_name": thing_name,
        "timestamp": timestamp,
    }

    if battery.get("battery_mv") is not None:
        item["battery_mv"] = battery["battery_mv"]
    if battery.get("battery_pct") is not None:
        item["battery_pct"] = battery["battery_pct"]
    if battery.get("is_charging") is not None:
        item["is_charging"] = battery["is_charging"]
    if battery.get("result") is not None:
        item["result"] = battery["result"]

    _battery_table.put_item(Item=item)
    print(f"DynamoDB battery write OK: thing_name={thing_name}, timestamp={timestamp}")


def write_temperature_data(thing_name: str, temperature: Optional[Dict[str, Any]]) -> None:
    """Write one row to Midori-Mon-WaterWatcher-DB-TemperatureSensor."""
    if not isinstance(temperature, dict):
        return

    timestamp = _utc_timestamp()

    item = {
        "thing_name": thing_name,
        "timestamp": timestamp,
    }

    if temperature.get("temperature_c") is not None:
        item["temperature_c"] = str(temperature["temperature_c"])  # Decimal互換のため文字列で保存
    if temperature.get("result") is not None:
        item["result"] = temperature["result"]

    _temperature_table.put_item(Item=item)
    print(f"DynamoDB temperature write OK: thing_name={thing_name}, timestamp={timestamp}")
