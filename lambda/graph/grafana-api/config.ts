// DynamoDB
export const DYNAMODB_TABLE_MOISTURE =
  process.env.DYNAMODB_TABLE_MOISTURE ?? 'Midori-Mon-WaterWatcher-DB-MoistureSensor';
export const DYNAMODB_TABLE_TEMPERATURE =
  process.env.DYNAMODB_TABLE_TEMPERATURE ?? 'Midori-Mon-WaterWatcher-DB-TemperatureSensor';
export const DYNAMODB_TABLE_BATTERY =
  process.env.DYNAMODB_TABLE_BATTERY ?? 'Midori-Mon-WaterWatcher-DB-DeviceBattery';

// Grafana SimpleJSON /search が返す候補の元になる Thing 名一覧（カンマ区切り）
export const THING_NAMES = (process.env.THING_NAMES ?? 'Midori-Mon-WaterWatcher-01')
  .split(',')
  .map((name) => name.trim())
  .filter((name) => name.length > 0);
