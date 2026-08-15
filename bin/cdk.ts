#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { FoundationStack } from '../lib/foundation/foundation-stack';
import { DeviceStack } from '../lib/device/device-stack';
import { GraphStack } from '../lib/graph/graph-stack';

const app = new cdk.App();

// 本番の手動構築リソースで使われていたタグ規則に合わせる（コスト集計・リソース識別用）
cdk.Tags.of(app).add('Midori-Mon-WaterWatcher', '');

const foundation = new FoundationStack(app, 'WaterWatcherFoundationStack');
const device = new DeviceStack(app, 'WaterWatcherDeviceStack');
const graph = new GraphStack(app, 'WaterWatcherGraphStack');

device.addDependency(foundation);
graph.addDependency(foundation);
