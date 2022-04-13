#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AppStack } from '../lib/app-stack';
import { StepFunctionApiStack } from '../lib/step-function-api';
import { StorageStack } from '../lib/storage';
import { StepFunctionProcessStack } from '../lib/step-function-process';
import { LambdasStack } from '../lib/lambdas';

const app = new cdk.App();
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};
const appName = process.env.APP_NAME ? process.env.APP_NAME : 'Manovale';

const storage = new StorageStack(app, 'StorageStack', {
  env,
  appName,
});

const stepFunctionProcess = new StepFunctionProcessStack(
  app,
  'StepFunctionProcessStack',
  {
    env,
    appName,
    dynamoTable: storage.dynamoTable,
  }
);

new LambdasStack(app, 'LambdasStack', {
  env,
  appName,
  dlqQueue: storage.dlqQueue,
  dynamoTable: storage.dynamoTable,
  processMachine: stepFunctionProcess.Machine,
})

const stepFunctionApi = new StepFunctionApiStack(app, 'StepFunctionApiStack', {
  env,
  appName,
  dynamoTable: storage.dynamoTable,
  processMachine: stepFunctionProcess.Machine,
});

new AppStack(app, 'AppStack', {
  env,
  stateMachine: stepFunctionApi.Machine,
  appName,
  stageName: process.env.STAGE_NAME ? process.env.STAGE_NAME : 'dev',
});
