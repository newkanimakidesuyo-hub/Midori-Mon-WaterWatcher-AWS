// device / graph の両スタックから参照するDynamoDBテーブル名・Thing名。
// 実体（テーブル・Thing）はCDK未管理（既存デプロイ済みリソースをfromTableName等で参照するのみ）。
// ここでの定義がズレると、Lambda側の権限設定と実際のテーブル名が食い違うため、必ずこのファイルを唯一の情報源とする。

export const MOISTURE_TABLE_NAME = 'Midori-Mon-WaterWatcher-DB-MoistureSensor';
export const BATTERY_TABLE_NAME = 'Midori-Mon-WaterWatcher-DB-DeviceBattery';
export const TEMPERATURE_TABLE_NAME = 'Midori-Mon-WaterWatcher-DB-TemperatureSensor';

export const THING_NAMES = [
  'Midori-Mon-WaterWatcher-01',
  'Midori-Mon-WaterWatcher-02',
  'Midori-Mon-WaterWatcher-03',
];
