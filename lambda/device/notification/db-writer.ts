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
): Promise<void> {
  const timestamp = utcTimestamp();

  const item: Record<string, unknown> = {
    thing_name: thingName,
    timestamp,
    alerted,
  };

  if (moisture !== null) item.moisture = moisture;
  if (result !== null) item.result = result;

  await docClient.send(new PutCommand({ TableName: DYNAMODB_MOISTURE_TABLE_NAME, Item: item }));
  console.log(`DynamoDB moisture write OK: thing_name=${thingName}, timestamp=${timestamp}`);
}

/** Write one row to Midori-Mon-WaterWatcher-DB-DeviceBattery. */
export async function writeBatteryData(thingName: string, battery: BatteryInfo | null): Promise<void> {
  if (typeof battery !== 'object' || battery === null) return;

  const timestamp = utcTimestamp();

  const item: Record<string, unknown> = {
    thing_name: thingName,
    timestamp,
  };

  if (battery.battery_mv !== null) item.battery_mv = battery.battery_mv;
  if (battery.battery_pct !== null) item.battery_pct = battery.battery_pct;
  if (battery.is_charging !== null) item.is_charging = battery.is_charging;
  if (battery.result !== null) item.result = battery.result;

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
