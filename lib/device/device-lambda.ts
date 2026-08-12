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
  
}
