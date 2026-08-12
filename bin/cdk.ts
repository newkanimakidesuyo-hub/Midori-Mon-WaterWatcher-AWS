#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { FoundationStack } from '../lib/foundation/foundation-stack';
import { DeviceStack } from '../lib/device/device-stack';
import { GraphStack } from '../lib/graph/graph-stack';

const app = new cdk.App();

const foundation = new FoundationStack(app, 'WaterWatcherFoundationStack');
const device = new DeviceStack(app, 'WaterWatcherDeviceStack');
const graph = new GraphStack(app, 'WaterWatcherGraphStack');

device.addDependency(foundation);
graph.addDependency(foundation);
