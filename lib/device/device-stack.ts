import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { createDeviceLambdas } from './device-lambda';

export class DeviceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    createDeviceLambdas(this);

    // ここに他の IoT / デバイス関連リソースを追加します
  }
}
