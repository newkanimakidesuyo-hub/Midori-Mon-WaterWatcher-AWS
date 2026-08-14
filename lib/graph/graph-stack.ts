import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { createGraphApiGateway } from './graph-api-gateway';
import { createGraphLambdas } from './graph-lambda';

export class GraphStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const lambdas = createGraphLambdas(this);
    createGraphApiGateway(this, lambdas['WaterWatcherGrafanaGraphCdkFunction']);

    // 他のグラフ表示機能リソースをここに追加します
    // 例: AppSync、CloudFront、S3 など
  }
}
