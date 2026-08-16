function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// 通知先Discord WebhookのURLを保持するSSM Parameter Store (SecureString) の名前。
// Notification Lambdaと同一のパラメータを参照し、通知先チャンネルを1本化する。
export const DISCORD_WEBHOOK_URL_PARAM_NAME = requireEnv('DISCORD_WEBHOOK_URL_PARAM_NAME');

export const DYNAMODB_MOISTURE_TABLE_NAME =
  process.env.DYNAMODB_MOISTURE_TABLE_NAME ?? 'Midori-Mon-WaterWatcher-DB-MoistureSensor';

// カンマ区切りのThing名一覧
export const THING_NAMES = (process.env.THING_NAMES ?? '')
  .split(',')
  .map((name) => name.trim())
  .filter((name) => name.length > 0);

// この時間（時間単位）データが来ない場合に無応答アラートを出す
export const OFFLINE_THRESHOLD_HOURS = Number(process.env.OFFLINE_THRESHOLD_HOURS ?? '3');
