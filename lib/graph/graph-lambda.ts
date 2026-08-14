import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as path from 'path';

interface GraphLambdaConfig {
  /** Lambda関数のCFN論理ID */
  functionId: string;
  /** 専用LogGroupのCFN論理ID */
  logGroupId: string;
  functionName: string;
  runtime: lambda.Runtime;
  /** lambda/graph/ からのエントリーポイント（.ts） */
  entryFile: string;
  description: string;
  /** STACK_NAME に加えて付与する環境変数 */
  environment?: Record<string, string>;
}

const GRAPH_LAMBDAS: GraphLambdaConfig[] = [
  {
    // 既存デプロイ済みLambda（Midori-Mon-WaterWatcher-Grafana-Graph）のコードを移植。テスト目的
    functionId: 'WaterWatcherGrafanaGraphCdkFunction',
    logGroupId: 'WaterWatcherGrafanaGraphCdkFunctionLogGroupCustom',
    functionName: 'Midori-Mon-WaterWatcher-Grafana-Graph-cdk',
    runtime: lambda.Runtime.NODEJS_24_X,
    entryFile: 'grafana-api/grafana-api-handler.ts',
    description: 'Grafana SimpleJSON datasource API Lambda imported from existing deployment (for testing)',
    environment: {
      DYNAMODB_TABLE_MOISTURE: 'Midori-Mon-WaterWatcher-DB-MoistureSensor',
      DYNAMODB_TABLE_TEMPERATURE: 'Midori-Mon-WaterWatcher-DB-TemperatureSensor',
      THING_NAMES: 'Midori-Mon-WaterWatcher-01,Midori-Mon-WaterWatcher-02,Midori-Mon-WaterWatcher-03',
    },
  },
];

export function createGraphLambdas(stack: cdk.Stack) {
  for (const config of GRAPH_LAMBDAS) {
    const logGroup = new logs.LogGroup(stack, config.logGroupId, {
      logGroupName: `/aws/lambda/${config.functionName}`,
      retention: logs.RetentionDays.ONE_YEAR,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    new lambdaNodejs.NodejsFunction(stack, config.functionId, {
      functionName: config.functionName,
      runtime: config.runtime,
      entry: path.join(__dirname, '../../lambda/graph', config.entryFile),
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
