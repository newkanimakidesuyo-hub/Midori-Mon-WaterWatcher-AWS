import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as path from 'path';

interface NotificationLambdaConfig {
  /** Lambda関数のCFN論理ID */
  functionId: string;
  /** 専用LogGroupのCFN論理ID */
  logGroupId: string;
  functionName: string;
  runtime: lambda.Runtime;
  /** lambda/device/ からのエントリーポイント（.ts） */
  entryFile: string;
  description: string;
  /** STACK_NAME に加えて付与する環境変数 */
  environment?: Record<string, string>;
}

const MOISTURE_TABLE_NAME = 'Midori-Mon-WaterWatcher-DB-MoistureSensor';
const BATTERY_TABLE_NAME = 'Midori-Mon-WaterWatcher-DB-DeviceBattery';
const TEMPERATURE_TABLE_NAME = 'Midori-Mon-WaterWatcher-DB-TemperatureSensor';

// テスト用Discord WebhookのURLを保持するSSM Parameter Store (SecureString) の名前。
// 値自体はCDKで管理せず、事前に `aws ssm put-parameter --type SecureString` で登録しておく想定。
const DISCORD_WEBHOOK_URL_PARAM_NAME = '/midori-mon-waterwatcher/notification-cdk/discord-webhook-url';

const NOTIFICATION_LAMBDAS: NotificationLambdaConfig[] = [
  {
    functionId: 'WaterWatcherNotificationCdkFunction',
    logGroupId: 'WaterWatcherNotificationCdkFunctionLogGroupCustom',
    functionName: 'Midori-Mon-WaterWatcher-Notification-cdk',
    runtime: lambda.Runtime.NODEJS_18_X,
    entryFile: 'notification/notification-handler.ts',
    description: 'Test notification Lambda for WaterWatcher migration',
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
    const logGroup = new logs.LogGroup(stack, config.logGroupId, {
      logGroupName: `/aws/lambda/${config.functionName}`,
      retention: logs.RetentionDays.ONE_YEAR,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    functions[config.functionId] = new lambdaNodejs.NodejsFunction(stack, config.functionId, {
      functionName: config.functionName,
      runtime: config.runtime,
      entry: path.join(__dirname, '../../lambda/device', config.entryFile),
      depsLockFilePath: path.join(__dirname, '../../package-lock.json'),
      description: config.description,
      environment: {
        STACK_NAME: stack.stackName,
        ...config.environment,
      },
      logGroup,
    });
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

  // Discord Webhook URL（テスト用）。値はSSMに事前登録済みのものを実行時に取得する
  const webhookParam = ssm.StringParameter.fromSecureStringParameterAttributes(
    stack,
    'NotificationCdkDiscordWebhookParam',
    { parameterName: DISCORD_WEBHOOK_URL_PARAM_NAME },
  );
  webhookParam.grantRead(notificationFn);

  return functions;
}
