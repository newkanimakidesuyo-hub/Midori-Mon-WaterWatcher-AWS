import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';

export function createDeviceLambdas(stack: cdk.Stack) {

  new lambda.Function(stack, 'WaterWatcherNotificationCdkFunction', {
    functionName: 'Midori-Mon-WaterWatcher-Notification-cdk',
    runtime: lambda.Runtime.NODEJS_18_X,
    handler: 'notification-handler.handler',
    code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/device/notification')),
    description: 'Test notification Lambda for WaterWatcher migration',
    environment: {
      STACK_NAME: stack.stackName,
    },
  });
  
  // Python version (imported from existing deployment) for testing
  new lambda.Function(stack, 'WaterWatcherNotificationCdkFunctionPy', {
    functionName: 'Midori-Mon-WaterWatcher-Notification-cdk-py',
    runtime: lambda.Runtime.PYTHON_3_9,
    handler: 'lambda_function.lambda_handler',
    code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/device/notification_python')),
    description: 'Python notification Lambda imported from existing deployment (for testing)',
    environment: {
      STACK_NAME: stack.stackName,
    },
  });
}
