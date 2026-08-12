import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class GraphStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // グラフ表示機能リソースをここに追加します
    // 例: AppSync、API Gateway、Lambda、CloudFront、S3 など
  }
}
