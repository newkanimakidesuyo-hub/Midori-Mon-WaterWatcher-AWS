import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { createGraphLambdas } from './graph-lambda';

export class GraphStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    createGraphLambdas(this);

    // 他のグラフ表示機能リソースをここに追加します
    // 例: AppSync、API Gateway、CloudFront、S3 など
  }
}
