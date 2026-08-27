import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';
import { createLambdaWithLogGroup, LambdaWithLogGroupConfig } from '../shared/create-lambda';
import {
  BATTERY_TABLE_NAME,
  MOISTURE_TABLE_NAME,
  TEMPERATURE_TABLE_NAME,
  THING_NAMES,
} from '../shared/water-watcher-constants';

const GRAPH_LAMBDAS: LambdaWithLogGroupConfig[] = [
  {
    functionId: 'WaterWatcherGrafanaGraphCdkFunction',
    logGroupId: 'WaterWatcherGrafanaGraphCdkFunctionLogGroupCustom',
    functionName: 'Midori-Mon-WaterWatcher-Grafana-Graph-cdk',
    runtime: lambda.Runtime.NODEJS_24_X,
    entry: path.join(__dirname, '../../lambda/graph/grafana-api/grafana-api-handler.ts'),
    depsLockFilePath: path.join(__dirname, '../../package-lock.json'),
    description: 'Grafana SimpleJSON datasource API backed by DynamoDB (moisture / temperature_c / firmware_version)',
    timeout: cdk.Duration.seconds(3), // 本番と同値
    memorySize: 128, // 本番と同値
    environment: {
      DYNAMODB_TABLE_MOISTURE: MOISTURE_TABLE_NAME,
      DYNAMODB_TABLE_TEMPERATURE: TEMPERATURE_TABLE_NAME,
      DYNAMODB_TABLE_BATTERY: BATTERY_TABLE_NAME,
      THING_NAMES: THING_NAMES.join(','),
    },
  },
];

export function createGraphLambdas(stack: cdk.Stack): Record<string, lambdaNodejs.NodejsFunction> {
  const functions: Record<string, lambdaNodejs.NodejsFunction> = {};

  for (const config of GRAPH_LAMBDAS) {
    functions[config.functionId] = createLambdaWithLogGroup(stack, config);
  }

  // Grafana-Graph は読み取り専用でMoisture/Temperature/Batteryテーブルを参照する（本番と同じ既存テーブルをimport）
  const grafanaGraphFn = functions['WaterWatcherGrafanaGraphCdkFunction'];
  const moistureTable = dynamodb.Table.fromTableName(stack, 'GrafanaGraphCdkMoistureTableRef', MOISTURE_TABLE_NAME);
  const temperatureTable = dynamodb.Table.fromTableName(
    stack,
    'GrafanaGraphCdkTemperatureTableRef',
    TEMPERATURE_TABLE_NAME,
  );
  const batteryTable = dynamodb.Table.fromTableName(stack, 'GrafanaGraphCdkBatteryTableRef', BATTERY_TABLE_NAME);
  moistureTable.grantReadData(grafanaGraphFn);
  temperatureTable.grantReadData(grafanaGraphFn);
  batteryTable.grantReadData(grafanaGraphFn);

  return functions;
}
