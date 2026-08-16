import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';

export interface LambdaWithLogGroupConfig {
  /** Lambda関数のCFN論理ID */
  functionId: string;
  /** 専用LogGroupのCFN論理ID */
  logGroupId: string;
  functionName: string;
  runtime: lambda.Runtime;
  /** エントリーポイント(.ts)の絶対パス */
  entry: string;
  depsLockFilePath: string;
  description: string;
  timeout: cdk.Duration;
  memorySize: number;
  reservedConcurrentExecutions?: number;
  /** STACK_NAME に加えて付与する環境変数 */
  environment?: Record<string, string>;
}

/**
 * 専用LogGroup付きのNodejsFunctionを作成する共通ヘルパー。
 * device-lambda.ts / graph-lambda.ts で重複していた「LogGroup作成→NodejsFunction作成」を切り出したもの。
 */
export function createLambdaWithLogGroup(
  stack: cdk.Stack,
  config: LambdaWithLogGroupConfig,
): lambdaNodejs.NodejsFunction {
  const logGroup = new logs.LogGroup(stack, config.logGroupId, {
    logGroupName: `/aws/lambda/${config.functionName}`,
    retention: logs.RetentionDays.ONE_YEAR,
    removalPolicy: cdk.RemovalPolicy.DESTROY,
  });

  return new lambdaNodejs.NodejsFunction(stack, config.functionId, {
    functionName: config.functionName,
    runtime: config.runtime,
    entry: config.entry,
    depsLockFilePath: config.depsLockFilePath,
    description: config.description,
    timeout: config.timeout,
    memorySize: config.memorySize,
    reservedConcurrentExecutions: config.reservedConcurrentExecutions,
    environment: {
      STACK_NAME: stack.stackName,
      ...config.environment,
    },
    logGroup,
  });
}

/**
 * IoT Shadowの読み書き権限（`Midori-Mon-WaterWatcher-*` プレフィックス一致）をLambdaに付与する共通ヘルパー。
 * device-lambda.ts / device-monitor.ts で同一のPolicyStatementが重複していたため切り出した。
 */
export function grantThingShadowAccess(
  stack: cdk.Stack,
  fn: lambda.IFunction,
  thingNamePrefix = 'Midori-Mon-WaterWatcher-*',
): void {
  fn.addToRolePolicy(
    new iam.PolicyStatement({
      sid: 'ShadowReadWriteByPrefix',
      actions: ['iot:GetThingShadow', 'iot:UpdateThingShadow'],
      resources: [cdk.Arn.format({ service: 'iot', resource: 'thing', resourceName: thingNamePrefix }, stack)],
    }),
  );
}
