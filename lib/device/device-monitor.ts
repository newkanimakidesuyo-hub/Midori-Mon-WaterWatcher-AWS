import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as path from 'path';
import { createLambdaWithLogGroup } from '../shared/create-lambda';
import { MOISTURE_TABLE_NAME, THING_NAMES } from '../shared/water-watcher-constants';

const FUNCTION_NAME = 'Midori-Mon-WaterWatcher-DeviceMonitor-cdk';
const OFFLINE_THRESHOLD_HOURS = 3;
const CHECK_INTERVAL = cdk.Duration.minutes(30);

// Notification-cdkと同一のSSMパラメータを参照し、通知先Discordチャンネルを1本化する
const DISCORD_WEBHOOK_URL_PARAM_NAME = '/midori-mon-waterwatcher/notification-cdk/discord-webhook-url';

/**
 * デバイスからのデータが一定時間（デフォルト3時間）届かない場合にDiscordへ通知するLambda。
 * IoT Rule駆動のNotification-cdkとは異なり、「データが来ないこと」自体を検知する必要があるため、
 * EventBridgeによる定期実行（30分間隔）で全Thingの最終データ受信時刻をチェックする。
 */
export function createDeviceMonitor(stack: cdk.Stack): lambda.IFunction {
  const monitorFn = createLambdaWithLogGroup(stack, {
    functionId: 'WaterWatcherDeviceMonitorCdkFunction',
    logGroupId: 'WaterWatcherDeviceMonitorCdkFunctionLogGroupCustom',
    functionName: FUNCTION_NAME,
    runtime: lambda.Runtime.NODEJS_18_X,
    entry: path.join(__dirname, '../../lambda/device/device-monitor/device-monitor-handler.ts'),
    depsLockFilePath: path.join(__dirname, '../../package-lock.json'),
    description: 'Alerts via Discord when a WaterWatcher device stops reporting for longer than the configured threshold',
    timeout: cdk.Duration.seconds(30), // 複数Thing分を順に処理するため、Notification-cdkより長めに確保
    memorySize: 128,
    environment: {
      DYNAMODB_MOISTURE_TABLE_NAME: MOISTURE_TABLE_NAME,
      THING_NAMES: THING_NAMES.join(','),
      OFFLINE_THRESHOLD_HOURS: String(OFFLINE_THRESHOLD_HOURS),
      DISCORD_WEBHOOK_URL_PARAM_NAME,
    },
  });

  // DynamoDB: 最終受信タイムスタンプ取得のための読み取り専用権限
  const moistureTable = dynamodb.Table.fromTableName(stack, 'DeviceMonitorCdkMoistureTableRef', MOISTURE_TABLE_NAME);
  moistureTable.grantReadData(monitorFn);

  // IoT Shadow: 無応答アラート済みフラグの読み書き
  monitorFn.addToRolePolicy(
    new iam.PolicyStatement({
      sid: 'ShadowReadWriteByPrefix',
      actions: ['iot:GetThingShadow', 'iot:UpdateThingShadow'],
      resources: [cdk.Arn.format({ service: 'iot', resource: 'thing', resourceName: 'Midori-Mon-WaterWatcher-*' }, stack)],
    }),
  );

  // Discord Webhook URL（Notification-cdkと共通のパラメータ）
  const webhookParam = ssm.StringParameter.fromSecureStringParameterAttributes(
    stack,
    'DeviceMonitorCdkDiscordWebhookParam',
    { parameterName: DISCORD_WEBHOOK_URL_PARAM_NAME },
  );
  webhookParam.grantRead(monitorFn);

  new events.Rule(stack, 'WaterWatcherDeviceMonitorCdkSchedule', {
    ruleName: 'Midori-Mon-WaterWatcher-DeviceMonitor-cdk-Schedule',
    description: 'Periodically triggers DeviceMonitor-cdk to check for offline WaterWatcher devices',
    schedule: events.Schedule.rate(CHECK_INTERVAL),
    targets: [new targets.LambdaFunction(monitorFn)],
  });

  return monitorFn;
}
