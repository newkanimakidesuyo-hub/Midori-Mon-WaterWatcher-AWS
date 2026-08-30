import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

import { DYNAMODB_TABLE_BATTERY, DYNAMODB_TABLE_MOISTURE, DYNAMODB_TABLE_TEMPERATURE, THING_NAMES } from './config';

// Grafana SimpleJSON datasource プラグイン向けのデータソースAPI。
// エンドポイント: GET / (ヘルスチェック), POST /search, POST /query/moisture, POST /query/temperature_c,
//                POST /query/firmware_version（機体ごとの現在値をtable形式で返す。時系列ではない）

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

type MetricType = 'moisture' | 'temperature_c';

interface ParsedTarget {
  thingName: string;
  metricType: MetricType;
}

interface GrafanaQueryTarget {
  target: string;
}

interface GrafanaQueryRequest {
  range: { from: string; to: string };
  targets: GrafanaQueryTarget[];
}

/** Grafanaのtarget文字列 "ThingName" または "ThingName:moisture" / "ThingName:temperature_c" を分解する。 */
function parseTarget(target: string): ParsedTarget {
  const [thingPart, metricPart] = target.split(':', 2);
  const thingName = thingPart?.trim() ?? '';
  const metricType = metricPart?.trim();

  if (metricType === 'moisture' || metricType === 'temperature_c') {
    return { thingName, metricType };
  }
  return { thingName: target.trim(), metricType: 'moisture' };
}

/** 1つのtargetについてDynamoDBから期間内のデータ点を取得し、Grafana SimpleJSON形式に整形する。 */
async function queryTarget(target: string, from: string, to: string) {
  const { thingName, metricType } = parseTarget(target);
  const table = metricType === 'temperature_c' ? DYNAMODB_TABLE_TEMPERATURE : DYNAMODB_TABLE_MOISTURE;

  const result = await docClient.send(
    new QueryCommand({
      TableName: table,
      KeyConditionExpression: 'thing_name = :name AND #ts BETWEEN :from AND :to',
      ExpressionAttributeNames: { '#ts': 'timestamp' },
      ExpressionAttributeValues: { ':name': thingName, ':from': from, ':to': to },
    }),
  );

  const datapoints: [number, number][] = [];
  for (const item of result.Items ?? []) {
    const rawValue = metricType === 'temperature_c' ? item.temperature_c : item.moisture;
    const value = Number.parseFloat(String(rawValue));
    const timeMs = new Date(item.timestamp).getTime();
    if (!Number.isFinite(value) || !Number.isFinite(timeMs)) continue;
    datapoints.push([value, timeMs]);
  }

  return { target, datapoints };
}

/** /search が返す候補一覧。各Thingについて素の名前とmoisture/temperature_c付きの3種類、加えて全機種横断のfirmware_versionを返す。 */
function buildSearchList(): string[] {
  const candidates = THING_NAMES.flatMap((thingName) => [
    thingName,
    `${thingName}:moisture`,
    `${thingName}:temperature_c`,
  ]);
  // firmware_versionはThingごとの時系列ではなく全機種を1つのtableで見せるため、Thing名を付けない単独ターゲット
  return [...new Set(candidates), 'firmware_version'];
}

type TableCell = number | string | boolean | null;

interface GrafanaTableResult {
  columns: { text: string; type: string }[];
  rows: TableCell[][];
  type: 'table';
}

interface ParsedFirmware {
  build_date: string | null;
  commit: string | null;
}

/**
 * "YYYYMMDD-<gitコミットハッシュ短縮形>" / "YYYYMMDD-unknown" を分解する。
 * inject_firmware_version.py（Deviceリポジトリ）が生成する形式に対応。想定外の文字列は全フィールドnull扱い。
 * 旧ファームが送ってくる "-dirty" サフィックスは無視する（後方互換）。SolarSensorと同一実装。
 */
function parseFirmwareVersion(raw: string): ParsedFirmware {
  const m = /^(\d{4})(\d{2})(\d{2})-([^-]+)(?:-dirty)?$/.exec(raw);
  if (!m) return { build_date: null, commit: null };

  const [, year, month, day, commit] = m;
  const buildDate = `${year}-${month}-${day}`;
  if (Number.isNaN(Date.parse(`${buildDate}T00:00:00Z`))) return { build_date: null, commit: null };

  return {
    build_date: buildDate,
    commit: commit === 'unknown' ? null : commit,
  };
}

interface FirmwareRow {
  timeMs: number;
  thingName: string;
  version: string;
  build_date: string | null;
  commit: string | null;
}

/**
 * 各Thingの最新ファームウェアバージョンをGrafana SimpleJSONのtable形式で返す。
 * moisture/temperature_cと違い「今の値」を機体ごとに並べて見たい情報のため時系列にはしない。
 *
 * 既存の Time / Thing / Firmware Version 列は後方互換のため残し、
 * build_date（"YYYY-MM-DD" / パース不可は null）、commit（短縮ハッシュ / unknown・未パースは null）、
 * is_latest（返却行のうち最大 build_date と一致するか。YYYY-MM-DD は辞書順=日付順）を追加する。
 * 全機体を同一ビルドで運用する前提の「更新漏れ」検知を Grafana 側で組めるようにするため。
 */
async function queryFirmwareVersionTable(): Promise<GrafanaTableResult> {
  const parsed = await Promise.all(
    THING_NAMES.map(async (thingName): Promise<FirmwareRow | null> => {
      const result = await docClient.send(
        new QueryCommand({
          TableName: DYNAMODB_TABLE_BATTERY,
          KeyConditionExpression: 'thing_name = :name',
          ExpressionAttributeValues: { ':name': thingName },
          ScanIndexForward: false,
          Limit: 1,
        }),
      );

      const item = result.Items?.[0];
      if (!item?.timestamp) return null;

      const timeMs = new Date(item.timestamp).getTime();
      if (!Number.isFinite(timeMs)) return null;

      const version = typeof item.firmware_version === 'string' ? item.firmware_version : '(unknown)';
      return { timeMs, thingName, version, ...parseFirmwareVersion(version) };
    }),
  );

  const present = parsed.filter((row): row is FirmwareRow => row !== null);

  // 返却行の中で最も新しい build_date を「最新」の基準にする（YYYY-MM-DD は辞書順比較で日付順）。
  const latestBuildDate = present.reduce<string | null>(
    (max, row) => (row.build_date !== null && (max === null || row.build_date > max) ? row.build_date : max),
    null,
  );

  return {
    columns: [
      { text: 'Time', type: 'time' },
      { text: 'Thing', type: 'string' },
      { text: 'Firmware Version', type: 'string' },
      { text: 'build_date', type: 'string' },
      { text: 'commit', type: 'string' },
      { text: 'is_latest', type: 'boolean' },
    ],
    rows: present.map((row) => [
      row.timeMs,
      row.thingName,
      row.version,
      row.build_date,
      row.commit,
      row.build_date !== null && row.build_date === latestBuildDate,
    ]),
    type: 'table',
  };
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const path = event.path ?? '/';
  const method = event.httpMethod;

  if (method === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  if (method === 'GET' && path === '/') {
    return { statusCode: 200, headers: CORS_HEADERS, body: 'OK' };
  }

  if (method === 'POST' && path === '/search') {
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(buildSearchList()) };
  }

  if (method === 'POST' && (path === '/query/moisture' || path === '/query/temperature_c')) {
    const body: GrafanaQueryRequest = JSON.parse(event.body ?? '{}');
    const { from, to } = body.range;
    const results = await Promise.all(body.targets.map((t) => queryTarget(t.target, from, to)));
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(results) };
  }

  if (method === 'POST' && path === '/query/firmware_version') {
    const table = await queryFirmwareVersionTable();
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify([table]) };
  }

  return { statusCode: 404, headers: CORS_HEADERS, body: JSON.stringify({ message: 'Not found' }) };
};
