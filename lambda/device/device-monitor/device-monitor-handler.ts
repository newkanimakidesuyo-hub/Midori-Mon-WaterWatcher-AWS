import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

import { DYNAMODB_MOISTURE_TABLE_NAME, OFFLINE_THRESHOLD_HOURS, THING_NAMES } from './config';
import { sendDiscordEmbed } from './discord-notifier';
import { getReportedFlags, updateReportedFlags } from '../../shared/iot-shadow-flags';

const SHADOW_FLAG_KEYS = ['offline_alerted'] as const;

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

interface LambdaResult {
  statusCode: number;
  body: string;
}

/** MoistureSensorテーブルから、指定Thingの最終受信タイムスタンプ(Date)を取得する。データが無ければnull。 */
async function getLastSeenAt(thingName: string): Promise<Date | null> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: DYNAMODB_MOISTURE_TABLE_NAME,
      KeyConditionExpression: 'thing_name = :name',
      ExpressionAttributeValues: { ':name': thingName },
      ScanIndexForward: false,
      Limit: 1,
    }),
  );

  const item = result.Items?.[0];
  if (!item?.timestamp) return null;

  const parsed = new Date(item.timestamp);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** 1台分のThingについて、無応答/復帰の判定と通知を行う。 */
async function checkThing(thingName: string, now: Date): Promise<string> {
  // DynamoDBの最終受信時刻取得とIoT Shadowのフラグ取得は互いに依存しないため並列化する
  const [lastSeenAt, flags] = await Promise.all([
    getLastSeenAt(thingName),
    getReportedFlags(thingName, SHADOW_FLAG_KEYS),
  ]);
  const alreadyAlerted = flags.offline_alerted;

  if (lastSeenAt === null) {
    console.log(`${thingName}: no data found. skip.`);
    return 'no data';
  }

  const elapsedHours = (now.getTime() - lastSeenAt.getTime()) / (1000 * 60 * 60);
  console.log(
    `${thingName}: lastSeenAt=${lastSeenAt.toISOString()}, elapsedHours=${elapsedHours.toFixed(2)}, ` +
      `threshold=${OFFLINE_THRESHOLD_HOURS}, alreadyAlerted=${alreadyAlerted}`,
  );

  if (elapsedHours >= OFFLINE_THRESHOLD_HOURS && !alreadyAlerted) {
    const text =
      `**${thingName}**\n📡 最終データ受信から${elapsedHours.toFixed(1)}時間、応答がありません。` +
      `\n最終受信: ${lastSeenAt.toISOString()}`;
    await sendDiscordEmbed('📡 デバイス無応答アラート', text, 0xffa500);
    await updateReportedFlags(thingName, { offline_alerted: true });
    return 'offline alert sent';
  }

  if (elapsedHours < OFFLINE_THRESHOLD_HOURS && alreadyAlerted) {
    const text = `**${thingName}**\n📡 データ受信を再開しました。`;
    await sendDiscordEmbed('📡 デバイス復帰', text, 0x4ecdc4);
    await updateReportedFlags(thingName, { offline_alerted: false });
    return 'recovery sent';
  }

  return 'no action';
}

export const handler = async (): Promise<LambdaResult> => {
  const now = new Date();
  console.log(`Checking ${THING_NAMES.length} thing(s): ${THING_NAMES.join(', ')}`);

  const results = await Promise.all(
    THING_NAMES.map(async (thingName) => {
      try {
        const outcome = await checkThing(thingName, now);
        return `${thingName}=${outcome}`;
      } catch (e) {
        console.error(`${thingName}: check failed: ${e}`);
        return `${thingName}=error`;
      }
    }),
  );

  const body = results.join(', ');
  console.log(body);
  return { statusCode: 200, body };
};
