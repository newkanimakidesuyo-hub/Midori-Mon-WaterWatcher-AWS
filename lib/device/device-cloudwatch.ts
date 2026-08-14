import * as cdk from 'aws-cdk-lib';
import * as logs from 'aws-cdk-lib/aws-logs';

export function createDeviceCloudWatch(stack: cdk.Stack) {
  const nodeFunctionName = 'Midori-Mon-WaterWatcher-Notification-cdk';
  const pyFunctionName = 'Midori-Mon-WaterWatcher-Notification-cdk-py';

  const nodeLogGroup = new logs.LogGroup(stack, 'WaterWatcherNotificationCdkFunctionLogGroupCustom', {
    logGroupName: `/aws/lambda/${nodeFunctionName}`,
    retention: logs.RetentionDays.ONE_YEAR,
    removalPolicy: cdk.RemovalPolicy.DESTROY,
  });

  const pyLogGroup = new logs.LogGroup(stack, 'WaterWatcherNotificationCdkFunctionPyLogGroupCustom', {
    logGroupName: `/aws/lambda/${pyFunctionName}`,
    retention: logs.RetentionDays.ONE_YEAR,
    removalPolicy: cdk.RemovalPolicy.DESTROY,
  });

  return { nodeLogGroup, pyLogGroup, nodeFunctionName, pyFunctionName };
}
