import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

import {
  DYNAMODB_BATTERY_TABLE_NAME,
  DYNAMODB_MOISTURE_TABLE_NAME,
  DYNAMODB_TEMPERATURE_TABLE_NAME,
} from './config';
import { BatteryInfo, TemperatureInfo } from './event-parser';

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function utcTimestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** Write one row to Midori-Mon-WaterWatcher-DB-MoistureSensor. */
export async function writeMoistureData(
  thingName: string,
  moisture: number | null,
  result: boolean | null,
  alerted: boolean,
  raw: number | null = null,
): Promise<void> {
  const timestamp = utcTimestamp();

  const item: Record<string, unknown> = {
    thing_name: thingName,
    timestamp,
    alerted,
  };

  if (moisture !== null) item.moisture = moisture;
  if (result !== null) item.result = result;
  // 生値。moisture=null（読み取り失敗）の行でも記録しておき、未接続の切り分けに使う。
  if (raw !== null) item.raw = raw;

  await docClient.send(new PutCommand({ TableName: DYNAMODB_MOISTURE_TABLE_NAME, Item: item }));
  console.log(`DynamoDB moisture write OK: thing_name=${thingName}, timestamp=${timestamp}`);
}

/** Write one row to Midori-Mon-WaterWatcher-DB-DeviceBattery. */
export async function writeBatteryData(
  thingName: string,
  battery: BatteryInfo | null,
  firmwareVersion: string | null,
): Promise<void> {
  // battery群が無くてもfirmware_versionだけは記録したいケースがあり得るため、
  // battery不在を理由に早期returnはしない（battery群のみ書かないだけ）。
  const timestamp = utcTimestamp();

  const item: Record<string, unknown> = {
    thing_name: thingName,
    timestamp,
  };

  if (battery !== null) {
    if (battery.battery_mv !== null) item.battery_mv = battery.battery_mv;
    if (battery.battery_pct !== null) item.battery_pct = battery.battery_pct;
    if (battery.is_charging !== null) item.is_charging = battery.is_charging;
    if (battery.result !== null) item.result = battery.result;
  }
  if (firmwareVersion !== null) item.firmware_version = firmwareVersion;

  // battery/firmware_versionのいずれも無ければ書き込む価値のある情報が無いためスキップ
  // (thing_name/timestamp以外に書くものがあるかを明示的に判定する。item のキー数を数える
  //  実装だと、将来別の常時フィールドが増えたときに閾値がズレて黙って壊れるため避ける)
  const hasData = battery !== null || firmwareVersion !== null;
  if (!hasData) return;

  await docClient.send(new PutCommand({ TableName: DYNAMODB_BATTERY_TABLE_NAME, Item: item }));
  console.log(`DynamoDB battery write OK: thing_name=${thingName}, timestamp=${timestamp}`);
}

/** Write one row to Midori-Mon-WaterWatcher-DB-TemperatureSensor. */
export async function writeTemperatureData(
  thingName: string,
  temperature: TemperatureInfo | null,
): Promise<void> {
  if (typeof temperature !== 'object' || temperature === null) return;

  const timestamp = utcTimestamp();

  const item: Record<string, unknown> = {
    thing_name: thingName,
    timestamp,
  };

  if (temperature.temperature_c !== null) {
    item.temperature_c = String(temperature.temperature_c); // Decimal互換のため文字列で保存
  }
  if (temperature.result !== null) item.result = temperature.result;

  await docClient.send(new PutCommand({ TableName: DYNAMODB_TEMPERATURE_TABLE_NAME, Item: item }));
  console.log(`DynamoDB temperature write OK: thing_name=${thingName}, timestamp=${timestamp}`);
}
