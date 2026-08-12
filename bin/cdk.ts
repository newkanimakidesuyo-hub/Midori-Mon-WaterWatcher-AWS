#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { FoundationStack } from '../lib/foundation/foundation-stack';
import { DeviceStack } from '../lib/device/device-stack';
import { GraphStack } from '../lib/graph/graph-stack';

const app = new cdk.App();

const foundation = new FoundationStack(app, 'FoundationStack');
const device = new DeviceStack(app, 'DeviceStack');
const graph = new GraphStack(app, 'GraphStack');

device.addDependency(foundation);
graph.addDependency(foundation);
