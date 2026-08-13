import * as cdk from 'aws-cdk-lib';
import * as logs from 'aws-cdk-lib/aws-logs';

export function createDeviceCloudWatch(stack: cdk.Stack) {
  const makeSafeName = (base: string, stackName: string) => {
    const raw = `${base}-${stackName}`;
    return raw.length <= 64 ? raw : raw.slice(0, 64);
  };

  const nodeFunctionName = makeSafeName('MW-Notify-cdk', stack.stackName);
  const pyFunctionName = makeSafeName('MW-Notify-cdk-py', stack.stackName);

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
