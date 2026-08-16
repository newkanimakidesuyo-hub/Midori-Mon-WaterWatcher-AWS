import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as path from 'path';
import { createLambdaWithLogGroup, grantThingShadowAccess, LambdaWithLogGroupConfig } from '../shared/create-lambda';
import {
  BATTERY_TABLE_NAME,
  DEVICE_HEALTH_WEBHOOK_URL_PARAM_NAME,
  DISCORD_WEBHOOK_URL_PARAM_NAME,
  MOISTURE_TABLE_NAME,
  TEMPERATURE_TABLE_NAME,
} from '../shared/water-watcher-constants';

const NOTIFICATION_LAMBDAS: LambdaWithLogGroupConfig[] = [
  {
    functionId: 'WaterWatcherNotificationCdkFunction',
    logGroupId: 'WaterWatcherNotificationCdkFunctionLogGroupCustom',
    functionName: 'Midori-Mon-WaterWatcher-Notification-cdk',
    runtime: lambda.Runtime.NODEJS_18_X,
    entry: path.join(__dirname, '../../lambda/device/notification/notification-handler.ts'),
    depsLockFilePath: path.join(__dirname, '../../package-lock.json'),
    description: 'Sends a Discord alert and writes sensor readings to DynamoDB when a WaterWatcher device reports its IoT Shadow',
    // 本番は3秒設定だが、-cdk版はDiscord Webhook URLをSSMから毎回取得する分レイテンシが増えるため余裕を持たせる
    // (実測: DynamoDB書き込み×3 + SSM取得 + Discord送信 + Shadow更新で3秒ぎりぎり/超過を確認したため)
    timeout: cdk.Duration.seconds(10),
    memorySize: 128, // 本番と同値
    // 本番は5だが、あえて1に絞っている。同一Thingへの同時実行があると、IoT Shadowの
    // read-then-write（alerted/charging_alertedフラグ）がレースし、Discordへの重複通知が起きうるため。
    // デバイスは1台あたり1時間に1回程度の頻度でしか報告しないため、1に絞ってもスループット上の実害はない。
    reservedConcurrentExecutions: 1,
    environment: {
      DYNAMODB_MOISTURE_TABLE_NAME: MOISTURE_TABLE_NAME,
      DYNAMODB_BATTERY_TABLE_NAME: BATTERY_TABLE_NAME,
      DYNAMODB_TEMPERATURE_TABLE_NAME: TEMPERATURE_TABLE_NAME,
      DISCORD_WEBHOOK_URL_PARAM_NAME,
      DEVICE_HEALTH_WEBHOOK_URL_PARAM_NAME,
    },
  },
];

export function createDeviceLambdas(stack: cdk.Stack): Record<string, lambdaNodejs.NodejsFunction> {
  const functions: Record<string, lambdaNodejs.NodejsFunction> = {};

  for (const config of NOTIFICATION_LAMBDAS) {
    functions[config.functionId] = createLambdaWithLogGroup(stack, config);
  }

  // Notification: IoT Shadowの読み書き + Moisture/Battery/Temperatureテーブルへの書き込み権限（本番Lambdaの既存ポリシーと同一）
  const notificationFn = functions['WaterWatcherNotificationCdkFunction'];

  grantThingShadowAccess(stack, notificationFn);

  const moistureTable = dynamodb.Table.fromTableName(stack, 'NotificationCdkMoistureTableRef', MOISTURE_TABLE_NAME);
  const batteryTable = dynamodb.Table.fromTableName(stack, 'NotificationCdkBatteryTableRef', BATTERY_TABLE_NAME);
  const temperatureTable = dynamodb.Table.fromTableName(
    stack,
    'NotificationCdkTemperatureTableRef',
    TEMPERATURE_TABLE_NAME,
  );
  moistureTable.grant(notificationFn, 'dynamodb:PutItem');
  batteryTable.grant(notificationFn, 'dynamodb:PutItem');
  temperatureTable.grant(notificationFn, 'dynamodb:PutItem');

  // Discord Webhook URL（水分不足/回復用）。値はSSMに事前登録済みのものを実行時に取得する
  const webhookParam = ssm.StringParameter.fromSecureStringParameterAttributes(
    stack,
    'NotificationCdkDiscordWebhookParam',
    { parameterName: DISCORD_WEBHOOK_URL_PARAM_NAME },
  );
  webhookParam.grantRead(notificationFn);

  // Discord Webhook URL（給電停止/再開用、デバイス健全性チャンネル）
  const deviceHealthWebhookParam = ssm.StringParameter.fromSecureStringParameterAttributes(
    stack,
    'NotificationCdkDeviceHealthWebhookParam',
    { parameterName: DEVICE_HEALTH_WEBHOOK_URL_PARAM_NAME },
  );
  deviceHealthWebhookParam.grantRead(notificationFn);

  return functions;
}
