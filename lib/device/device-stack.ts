import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { createDeviceIotRule } from './device-iot-rule';
import { createDeviceLambdas } from './device-lambda';
import { createDeviceMonitor } from './device-monitor';

export class DeviceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const lambdas = createDeviceLambdas(this);
    createDeviceIotRule(this, lambdas['WaterWatcherNotificationCdkFunction']);
    createDeviceMonitor(this);

    // ここに他の IoT / デバイス関連リソースを追加します
  }
}
