import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
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

const NOTIFICATION_LAMBDAS: NotificationLambdaConfig[] = [
  {
    functionId: 'WaterWatcherNotificationCdkFunction',
    logGroupId: 'WaterWatcherNotificationCdkFunctionLogGroupCustom',
    functionName: 'Midori-Mon-WaterWatcher-Notification-cdk',
    runtime: lambda.Runtime.NODEJS_18_X,
    entryFile: 'notification/notification-handler.ts',
    description: 'Test notification Lambda for WaterWatcher migration',
  },
];

export function createDeviceLambdas(stack: cdk.Stack) {
  for (const config of NOTIFICATION_LAMBDAS) {
    const logGroup = new logs.LogGroup(stack, config.logGroupId, {
      logGroupName: `/aws/lambda/${config.functionName}`,
      retention: logs.RetentionDays.ONE_YEAR,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    new lambdaNodejs.NodejsFunction(stack, config.functionId, {
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
}
