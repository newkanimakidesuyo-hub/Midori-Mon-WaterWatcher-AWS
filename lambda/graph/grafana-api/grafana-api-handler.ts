import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

import { DYNAMODB_TABLE_BATTERY, DYNAMODB_TABLE_MOISTURE, DYNAMODB_TABLE_TEMPERATURE, THING_NAMES } from './config';

// Grafana SimpleJSON datasource プラグイン向けのデータソースAPI。
// エンドポイント: GET / (ヘルスチェック), POST /search, POST /query/moisture, POST /query/temperature_c,
//                POST /query/firmware_version（機体ごとの現在値をtable形式で返す。時系列ではない）,
//                POST /query/device_status（機体ごとの最終受信からの経過分をtable形式で返す。時系列ではない）

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
  // firmware_version / device_status はThingごとの時系列ではなく全機種を1つのtableで見せるため、Thing名を付けない単独ターゲット
  return [...new Set(candidates), 'firmware_version', 'device_status'];
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

// 最終受信から何分でオフラインとみなすか。device-monitor Lambda（lib/device/device-monitor.ts）の
// OFFLINE_THRESHOLD_HOURS = 3 と一致させる。Grafana の色分けと Discord の無応答アラートで判定がズレると
// 「グラフは赤いのにアラートが来ない（逆も）」という混乱が起きるため。
const OFFLINE_THRESHOLD_MINUTES = 3 * 60;

interface DeviceStatusRow {
  lastReportMs: number | null;
  thingName: string;
  elapsedMinutes: number | null;
  elapsedHours: number | null;
  online: boolean;
}

/**
 * 各Thingの「最終データ受信からの経過時間」をGrafana SimpleJSONのtable形式で返す。
 * firmware_versionと同じ「今の値を機体ごとに並べる」クエリで、Stat パネルでのオンライン状態一目確認用。
 *
 * 最終受信は device-monitor Lambda と同じ Moisture テーブルの最新 timestamp を基準にする
 * （firmware_version が使う Battery テーブルではなく、無応答アラートと同一ソースに揃える）。
 * elapsed_minutes（判定用の分）/ elapsed_hours（表示用。小数1桁）/ online は Lambda 側で算出する
 * （Grafana 側だと "now" の扱いがデータソース依存になるため。Stat パネルは h 単位固定で見せたいので
 * 分から時間への換算も Lambda 側でやり、Grafana の自動単位スケーリング（min/day/week）を避ける）。
 * データが1件も無い Thing は各経過値を null、online を false で返す。
 */
async function queryDeviceStatusTable(nowMs: number): Promise<GrafanaTableResult> {
  const rows = await Promise.all(
    THING_NAMES.map(async (thingName): Promise<DeviceStatusRow> => {
      const result = await docClient.send(
        new QueryCommand({
          TableName: DYNAMODB_TABLE_MOISTURE,
          KeyConditionExpression: 'thing_name = :name',
          ExpressionAttributeValues: { ':name': thingName },
          ScanIndexForward: false,
          Limit: 1,
        }),
      );

      const item = result.Items?.[0];
      const lastReportMs = item?.timestamp ? new Date(item.timestamp).getTime() : Number.NaN;
      if (!Number.isFinite(lastReportMs)) {
        return { lastReportMs: null, thingName, elapsedMinutes: null, elapsedHours: null, online: false };
      }

      // 時計ずれ等で未来の timestamp が来ても負値にしない
      const elapsedMs = Math.max(0, nowMs - lastReportMs);
      const elapsedMinutes = Math.round(elapsedMs / 60_000);
      return {
        lastReportMs,
        thingName,
        elapsedMinutes,
        elapsedHours: Math.round(elapsedMs / 3_600_000 * 10) / 10,
        online: elapsedMinutes < OFFLINE_THRESHOLD_MINUTES,
      };
    }),
  );

  return {
    columns: [
      { text: 'Time', type: 'time' },
      { text: 'Thing', type: 'string' },
      { text: 'elapsed_minutes', type: 'number' },
      { text: 'elapsed_hours', type: 'number' },
      { text: 'online', type: 'boolean' },
    ],
    rows: rows.map((row) => [
      row.lastReportMs,
      row.thingName,
      row.elapsedMinutes,
      row.elapsedHours,
      row.online,
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

  if (method === 'POST' && path === '/query/device_status') {
    const table = await queryDeviceStatusTable(Date.now());
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify([table]) };
  }

  return { statusCode: 404, headers: CORS_HEADERS, body: JSON.stringify({ message: 'Not found' }) };
};
