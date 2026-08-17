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

// 通知先Discord WebhookのURLを保持するSSM Parameter Store (SecureString) の名前。
// 水分不足/回復の通知チャンネル。Notification-cdkのみが使用する。
export const DISCORD_WEBHOOK_URL_PARAM_NAME = '/midori-mon-waterwatcher/notification-cdk/discord-webhook-url';

// デバイスの健全性に関する通知（給電停止/再開、デバイス無応答/復帰）専用のチャンネル。
// 水分不足の通知と機能が混ざらないよう、Notification-cdk / DeviceMonitor-cdk の両方がこちらを参照する。
export const DEVICE_HEALTH_WEBHOOK_URL_PARAM_NAME =
  '/midori-mon-waterwatcher/notification-cdk/discord-webhook-url-device-health';

// Route53で取得済みのドメイン（ホストゾーンはCDK未管理、Route53 Registrar経由で作成済み）。
// Grafana-Graph APIのカスタムドメイン化に使用する。
export const DOMAIN_NAME = 'midori-mon.link';
export const HOSTED_ZONE_ID = 'Z01077413V66BOO2N1QJ';

// Grafana-Graph API Gatewayのカスタムドメイン名。
export const GRAFANA_API_DOMAIN_NAME = `api.${DOMAIN_NAME}`;
