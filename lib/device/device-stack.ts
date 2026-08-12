import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class DeviceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // デバイス関連機能リソースをここに追加します
    // 例: IoT Core、DynamoDB、Lambda、デバイスの状態管理など
  }
}
