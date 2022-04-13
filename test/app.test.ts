import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as App from '../lib/app-stack';
import { StepFunctionApiStack } from '../lib/step-function-api';
import { StepFunctionProcessStack } from '../lib/step-function-process';
import { StorageStack } from '../lib/storage';
import { StateMachineType } from 'aws-cdk-lib/aws-stepfunctions';
import { LambdasStack } from '../lib/lambdas';

describe('Test', () => {
  jest.setTimeout(30000);

  const appName = 'Test';

  const app = new cdk.App();
  const storageStack = new StorageStack(app, 'storageStack', {
    appName,
  });
  const processStack = new StepFunctionProcessStack(app, 'ProcessStack', {
    dynamoTable: storageStack.dynamoTable,
    appName,
  });
  const apiStack = new StepFunctionApiStack(app, 'ApiStack', {
    processMachine: processStack.Machine,
    dynamoTable: storageStack.dynamoTable,
    appName,
  });

  const lambdaStack = new LambdasStack(app, 'LambdasStack', {
    processMachine: processStack.Machine,
    appName,
    dynamoTable: storageStack.dynamoTable,
    dlqQueue: storageStack.dlqQueue,
  });

  const appStack = new App.AppStack(app, 'MyTestStack', {
    stateMachine: apiStack.Machine,
    appName,
    stageName: 'test',
  });
  const appTemplate = Template.fromStack(appStack);
  const apiTemplate = Template.fromStack(apiStack);
  const storageTemplate = Template.fromStack(storageStack);
  const processTemplate = Template.fromStack(processStack);
  const lambdasTemplate = Template.fromStack(lambdaStack);

  test('Has Dynamodb Single Table', () => {
    storageTemplate.hasResource('AWS::DynamoDB::Table', {
      Properties: {
        KeySchema: [
          {
            AttributeName: `pk`,
            KeyType: 'HASH',
          },
          {
            AttributeName: `sk`,
            KeyType: 'RANGE',
          },
        ],
        AttributeDefinitions: [
          {
            AttributeName: `pk`,
            AttributeType: 'S',
          },
          {
            AttributeName: `sk`,
            AttributeType: 'S',
          },
        ],
        BillingMode: 'PAY_PER_REQUEST',
        TableName: appName,
        TimeToLiveSpecification: {
          AttributeName: 'delay',
          Enabled: true,
        },
      },
    });
  });

  test('Has Dlq Queue', () => {
    storageTemplate.hasResource('AWS::SQS::Queue', {
      Properties: {
        QueueName: `${appName}Dlq`,
      VisibilityTimeout: 300,
      }
    });
  });

  test('Has StepFunctions APIGateway', () => {
    appTemplate.hasResource('AWS::ApiGateway::RestApi', {});
  });

  test('Has StepFunctions for ApiGateway (Express type)', () => {
    apiTemplate.hasResource('AWS::StepFunctions::StateMachine', {
      Properties: {
        StateMachineName: `${appName}Api`,
        StateMachineType: StateMachineType.EXPRESS,
      },
    });
  });

  test('Has StepFunctions for Process (Express type)', () => {
    processTemplate.hasResource('AWS::StepFunctions::StateMachine', {
      Properties: {
        StateMachineName: `${appName}Process`,
        StateMachineType: StateMachineType.EXPRESS,
      },
    });
  });

  test('Has Lambda for Delayed jobs', () => {
    lambdasTemplate.hasResource('AWS::Lambda::Function', {
      Properties: {
        FunctionName: `${appName}StartProcess`,
        Timeout: 15,
      },
    });
  });
});
