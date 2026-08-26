import { requireEnv } from '../../shared/env';

// Environment variables
// DISCORD_WEBHOOK_URL は値そのものではなく、SSM Parameter Store (SecureString) のパラメータ名を渡す。
// 実際の値は discord-notifier.ts が実行時にSSMから取得する。
// 水分不足/回復の通知チャンネル
export const DISCORD_WEBHOOK_URL_PARAM_NAME = requireEnv('DISCORD_WEBHOOK_URL_PARAM_NAME');
// 給電停止/再開の通知チャンネル（水分不足とは別チャンネル）
export const DEVICE_HEALTH_WEBHOOK_URL_PARAM_NAME = requireEnv('DEVICE_HEALTH_WEBHOOK_URL_PARAM_NAME');
export const THING_NAME = process.env.THING_NAME ?? 'Midori-Mon-WaterWatcher';

// DynamoDB
export const DYNAMODB_MOISTURE_TABLE_NAME =
  process.env.DYNAMODB_MOISTURE_TABLE_NAME ?? 'Midori-Mon-WaterWatcher-DB-MoistureSensor';
export const DYNAMODB_BATTERY_TABLE_NAME =
  process.env.DYNAMODB_BATTERY_TABLE_NAME ?? 'Midori-Mon-WaterWatcher-DB-DeviceBattery';
export const DYNAMODB_TEMPERATURE_TABLE_NAME =
  process.env.DYNAMODB_TEMPERATURE_TABLE_NAME ?? 'Midori-Mon-WaterWatcher-DB-TemperatureSensor';

// Thresholds
export const LOW_THRESHOLD = 30;
export const RECOVERY_THRESHOLD = 60;

// 満充電付近（この%以上）での給電停止は、充電IC側の「充電完了→再充電」サイクル（正常挙動）による
// ものであり実際のリスクではないため、給電停止アラートの対象から除外する
// （Midori-Mon-SolarSensorの実データで、battery_pct 80〜100%の範囲でis_chargingが繰り返し反転することを確認済み）。
// デバイスのバッテリー容量は小さく、本当に給電が止まった場合は短時間で電池切れになりうるため、
// 除外はこの範囲に限定し、それ以外は待ち時間を設けず即時通知する。
export const CHARGING_STOP_SUPPRESS_MIN_PCT = 80;

// Message templates
export const LOW_MESSAGES = [
  '💧 みどりモンだよ！のどカラカラ… お水ちょうだい〜！',
  '🌱 ピンチ！土がかわいてるよ。ひとくち給水お願いっ！',
  '🪴 しょんぼり中… 水分が足りないみたい！助けて〜！',
];

export const RECOVERY_MESSAGES = [
  '✨ みどりモン復活！お水ありがとう〜！',
  '🌈 うるおいチャージ完了！元気になったよ！',
  '🍀 回復したよ！この調子で見守ってね！',
];
