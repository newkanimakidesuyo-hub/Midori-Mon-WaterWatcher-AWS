import { requireEnv } from '../../shared/env';

// 通知先Discord WebhookのURLを保持するSSM Parameter Store (SecureString) の名前。
// Notification Lambdaと同一のパラメータを参照し、通知先チャンネルを1本化する。
export const DISCORD_WEBHOOK_URL_PARAM_NAME = requireEnv('DISCORD_WEBHOOK_URL_PARAM_NAME');

export const DYNAMODB_MOISTURE_TABLE_NAME =
  process.env.DYNAMODB_MOISTURE_TABLE_NAME ?? 'Midori-Mon-WaterWatcher-DB-MoistureSensor';

// カンマ区切りのThing名一覧
function parseThingNames(): string[] {
  const names = (process.env.THING_NAMES ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name.length > 0);

  if (names.length === 0) {
    // 空のまま使うと監視対象0件で毎回200 OKを返し、機能が実質無効化されていることに気づけないため、
    // 起動時に検知して落とす。
    throw new Error('THING_NAMES must contain at least one thing name (comma-separated)');
  }

  return names;
}

export const THING_NAMES = parseThingNames();

// この時間（時間単位）データが来ない場合に無応答アラートを出す。
// CDK側（lib/device/device-monitor.ts）が唯一の設定値として必ず渡す前提で、ここではデフォルト値を持たない
// （デフォルトを両方に持つと値がズレるリスクがあるため）。
function parseOfflineThresholdHours(): number {
  const raw = requireEnv('OFFLINE_THRESHOLD_HOURS');
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    // NaNのまま使うと閾値比較が常にfalseになり、アラートが一切発報されなくなる（エラーも出ない）ため、
    // 起動時に検知して落とす。
    throw new Error(`OFFLINE_THRESHOLD_HOURS must be a positive number, got: "${raw}"`);
  }
  return parsed;
}

export const OFFLINE_THRESHOLD_HOURS = parseOfflineThresholdHours();
