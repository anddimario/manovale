import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  Runtime,
  Function,
  Code,
  Architecture,
  LayerVersion,
  StartingPosition,
} from 'aws-cdk-lib/aws-lambda';
import {
  DynamoEventSource,
  SqsDlq,
} from 'aws-cdk-lib/aws-lambda-event-sources';
import * as path from 'path';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { Policy, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { StateMachine } from 'aws-cdk-lib/aws-stepfunctions';

interface LambdasStackProps extends StackProps {
  dynamoTable: Table;
  dlqQueue: Queue;
  appName: string;
  processMachine: StateMachine;
}

export class LambdasStack extends Stack {
  constructor(scope: Construct, id: string, props: LambdasStackProps) {
    super(scope, id, props);
    const { dlqQueue, dynamoTable, appName, processMachine } = props;

    const lambdasBasicConfig = {
      memorySize: 1024,
      timeout: Duration.seconds(15),
      runtime: Runtime.NODEJS_14_X,
      architecture: Architecture.ARM_64,
      logRetention: 30,
      environment: {
        TABLE_NAME: dynamoTable.tableName,
      },
    };
    const lambdasPath = path.join(__dirname, '/../lambdas');

    const startProcess = new Function(this, 'startProcess', {
      ...lambdasBasicConfig,
      functionName: `${appName}StartProcess`,
      code: Code.fromAsset(`${lambdasPath}/startProcess`),
      handler: 'index.handler',
    });

    // Lambda events
    // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_lambda_event_sources.DynamoEventSource.html
    startProcess.addEventSource(
      new DynamoEventSource(dynamoTable, {
        startingPosition: StartingPosition.TRIM_HORIZON,
        batchSize: 5,
        bisectBatchOnError: true,
        onFailure: new SqsDlq(dlqQueue),
        retryAttempts: 3,
      })
    );

    const accountId = Stack.of(this).account;
    const region = Stack.of(this).region;
    // 👇 create a policy statement
    const listMachinesPermission = new PolicyStatement({
      actions: ['states:ListStateMachines'],
      resources: [`arn:aws:states:${region}:${accountId}:stateMachine:*`],
    });
    const startProcessPermission = new PolicyStatement({
      actions: ['states:StartExecution'],
      resources: [processMachine.stateMachineArn],
    });

    // 👇 add the policy to the Function's role
    startProcess.role?.attachInlinePolicy(
      new Policy(this, 'startProcessMachine', {
        statements: [listMachinesPermission, startProcessPermission],
      })
    );
  }
}
