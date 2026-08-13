import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { createDeviceLambdas } from './device-lambda';
import { createDeviceCloudWatch } from './device-cloudwatch';

export class DeviceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const logs = createDeviceCloudWatch(this);
    createDeviceLambdas(this, logs);

    // ここに他の IoT / デバイス関連リソースを追加します
  }
}
