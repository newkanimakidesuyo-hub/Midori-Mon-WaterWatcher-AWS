import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as path from 'path';

export function createDeviceLambdas(stack: cdk.Stack, opts: { nodeLogGroup: logs.LogGroup; pyLogGroup: logs.LogGroup; nodeFunctionName: string; pyFunctionName: string; }) {
  const { nodeLogGroup, pyLogGroup, nodeFunctionName, pyFunctionName } = opts;

  new lambda.Function(stack, 'WaterWatcherNotificationCdkFunction', {
    functionName: nodeFunctionName,
    runtime: lambda.Runtime.NODEJS_18_X,
    handler: 'notification-handler.handler',
    code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/device/notification')),
    description: 'Test notification Lambda for WaterWatcher migration',
    environment: {
      STACK_NAME: stack.stackName,
    },
    logGroup: nodeLogGroup,
  });

  // Python version (imported from existing deployment) for testing
  new lambda.Function(stack, 'WaterWatcherNotificationCdkFunctionPy', {
    functionName: pyFunctionName,
    runtime: lambda.Runtime.PYTHON_3_9,
    handler: 'lambda_function.lambda_handler',
    code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/device/notification_python')),
    description: 'Python notification Lambda imported from existing deployment (for testing)',
    environment: {
      STACK_NAME: stack.stackName,
    },
    logGroup: pyLogGroup,
  });
}
