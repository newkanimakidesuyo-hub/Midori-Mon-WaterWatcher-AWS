function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Environment variables
export const DISCORD_WEBHOOK_URL = requireEnv('DISCORD_WEBHOOK_URL');
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
