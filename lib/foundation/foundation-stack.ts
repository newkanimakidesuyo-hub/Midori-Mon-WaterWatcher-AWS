import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class FoundationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 共通機能リソースをここに追加します
    // 例: VPC、IAMロール、共通 SSM パラメータ、共通ロググループなど
  }
}
