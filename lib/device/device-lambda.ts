import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as path from 'path';
import { createLambdaWithLogGroup, LambdaWithLogGroupConfig } from '../shared/create-lambda';
import { BATTERY_TABLE_NAME, MOISTURE_TABLE_NAME, TEMPERATURE_TABLE_NAME } from '../shared/water-watcher-constants';

// 通知先Discord WebhookのURLを保持するSSM Parameter Store (SecureString) の名前。
// 値自体はCDKで管理せず、事前に `aws ssm put-parameter --type SecureString` で登録しておく想定。
const DISCORD_WEBHOOK_URL_PARAM_NAME = '/midori-mon-waterwatcher/notification-cdk/discord-webhook-url';

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
    reservedConcurrentExecutions: 5, // 本番と同値
    environment: {
      DYNAMODB_MOISTURE_TABLE_NAME: MOISTURE_TABLE_NAME,
      DYNAMODB_BATTERY_TABLE_NAME: BATTERY_TABLE_NAME,
      DYNAMODB_TEMPERATURE_TABLE_NAME: TEMPERATURE_TABLE_NAME,
      DISCORD_WEBHOOK_URL_PARAM_NAME,
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

  notificationFn.addToRolePolicy(
    new iam.PolicyStatement({
      sid: 'ShadowReadWriteByPrefix',
      actions: ['iot:GetThingShadow', 'iot:UpdateThingShadow'],
      resources: [cdk.Arn.format({ service: 'iot', resource: 'thing', resourceName: 'Midori-Mon-WaterWatcher-*' }, stack)],
    }),
  );

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

  // Discord Webhook URL。値はSSMに事前登録済みのものを実行時に取得する
  const webhookParam = ssm.StringParameter.fromSecureStringParameterAttributes(
    stack,
    'NotificationCdkDiscordWebhookParam',
    { parameterName: DISCORD_WEBHOOK_URL_PARAM_NAME },
  );
  webhookParam.grantRead(notificationFn);

  return functions;
}
