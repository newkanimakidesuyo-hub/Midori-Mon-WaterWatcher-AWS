import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as path from 'path';

export function createDeviceLambdas(stack: cdk.Stack) {

  const makeSafeName = (base: string, stackName: string) => {
    const raw = `${base}-${stackName}`;
    return raw.length <= 64 ? raw : raw.slice(0, 64);
  };

  const nodeFunctionName = makeSafeName('Midori-Mon-WaterWatcher-Notification-cdk', stack.stackName);

  // create an explicit LogGroup so we can control retention and removal
  new logs.LogGroup(stack, 'WaterWatcherNotificationCdkFunctionLogGroupCustom', {
    logGroupName: `/aws/lambda/${nodeFunctionName}`,
    retention: logs.RetentionDays.ONE_YEAR,
    removalPolicy: cdk.RemovalPolicy.DESTROY,
  });

  new lambda.Function(stack, 'WaterWatcherNotificationCdkFunction', {
    functionName: nodeFunctionName,
    runtime: lambda.Runtime.NODEJS_18_X,
    handler: 'notification-handler.handler',
    code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/device/notification')),
    description: 'Test notification Lambda for WaterWatcher migration',
    environment: {
      STACK_NAME: stack.stackName,
    },
  });
  
  // Python version (imported from existing deployment) for testing
  const pyFunctionName = makeSafeName('Midori-Mon-WaterWatcher-Notification-cdk-py', stack.stackName);

  new logs.LogGroup(stack, 'WaterWatcherNotificationCdkFunctionPyLogGroupCustom', {
    logGroupName: `/aws/lambda/${pyFunctionName}`,
    retention: logs.RetentionDays.ONE_YEAR,
    removalPolicy: cdk.RemovalPolicy.DESTROY,
  });

  new lambda.Function(stack, 'WaterWatcherNotificationCdkFunctionPy', {
    functionName: pyFunctionName,
    runtime: lambda.Runtime.PYTHON_3_9,
    handler: 'lambda_function.lambda_handler',
    code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/device/notification_python')),
    description: 'Python notification Lambda imported from existing deployment (for testing)',
    environment: {
      STACK_NAME: stack.stackName,
    },
  });
}
