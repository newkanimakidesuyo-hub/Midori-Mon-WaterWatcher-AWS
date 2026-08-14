import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

import { DYNAMODB_TABLE_MOISTURE, DYNAMODB_TABLE_TEMPERATURE, THING_NAMES } from './config';

// Grafana SimpleJSON datasource プラグイン向けのデータソースAPI。
// エンドポイント: GET / (ヘルスチェック), POST /search, POST /query/moisture, POST /query/temperature_c

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

/** /search が返す候補一覧。各Thingについて素の名前とmoisture/temperature_c付きの3種類を返す。 */
function buildSearchList(): string[] {
  const candidates = THING_NAMES.flatMap((thingName) => [
    thingName,
    `${thingName}:moisture`,
    `${thingName}:temperature_c`,
  ]);
  return [...new Set(candidates)];
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

  return { statusCode: 404, headers: CORS_HEADERS, body: JSON.stringify({ message: 'Not found' }) };
};
