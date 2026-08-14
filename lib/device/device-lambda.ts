import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as path from 'path';

interface NotificationLambdaConfig {
  /** Lambda関数のCFN論理ID */
  functionId: string;
  /** 専用LogGroupのCFN論理ID */
  logGroupId: string;
  functionName: string;
  runtime: lambda.Runtime;
  handler: string;
  /** lambda/device/ からのコードディレクトリ */
  codeDir: string;
  description: string;
}

const NOTIFICATION_LAMBDAS: NotificationLambdaConfig[] = [
  {
    functionId: 'WaterWatcherNotificationCdkFunction',
    logGroupId: 'WaterWatcherNotificationCdkFunctionLogGroupCustom',
    functionName: 'Midori-Mon-WaterWatcher-Notification-cdk',
    runtime: lambda.Runtime.NODEJS_18_X,
    handler: 'notification-handler.handler',
    codeDir: 'notification',
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

    new lambda.Function(stack, config.functionId, {
      functionName: config.functionName,
      runtime: config.runtime,
      handler: config.handler,
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/device', config.codeDir)),
      description: config.description,
      environment: {
        STACK_NAME: stack.stackName,
      },
      logGroup,
    });
  }
}
