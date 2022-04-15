import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import {
  Choice,
  Condition,
  IntegrationPattern,
  JsonPath,
  Pass,
  StateMachine,
  StateMachineType,
  TaskInput,
  LogLevel,
  Wait,
  WaitTime,
} from 'aws-cdk-lib/aws-stepfunctions';
import { Construct } from 'constructs';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';

interface StepFunctionProcessStackProps extends StackProps {
  appName: string;
  dynamoTable: Table;
}

export class StepFunctionProcessStack extends Stack {
  public Machine: StateMachine;

  constructor(
    scope: Construct,
    id: string,
    props: StepFunctionProcessStackProps
  ) {
    super(scope, id, props);

    const { appName, dynamoTable } = props;

    const addRunningJobDynamo = new tasks.DynamoPutItem(
      this,
      'taskPutItemRunning',
      {
        item: {
          pk: tasks.DynamoAttributeValue.fromString(
            JsonPath.stringAt('$.job.queue')
          ),
          sk: tasks.DynamoAttributeValue.fromString(
            JsonPath.stringAt('$.job.id')
          ),
          job: tasks.DynamoAttributeValue.mapFromJsonPath('$.job'),
          status: tasks.DynamoAttributeValue.fromString('running'),
        },
        table: dynamoTable,
        inputPath: '$',
        resultPath: `$.Item`,
      }
    );

    const incrQueueCount = new tasks.DynamoUpdateItem(this, 'IncrQueueCount', {
      key: {
        pk: tasks.DynamoAttributeValue.fromString('jobs:count:running'),
        sk: tasks.DynamoAttributeValue.fromString(
          JsonPath.stringAt('$.job.queue')
        ),
      },
      table: dynamoTable,
      updateExpression: 'SET TotalCount = TotalCount + 1',
      resultPath: `$.Item`,
      inputPath: '$',
    });

    // // Choice condition if value exists in dynamodb
    // const checkDelay = new Choice(this, 'Is it a delayed job?')
    //   .when(
    //     Condition.isPresent('$.body.delay'),
    //     addDelayedDynamo
    //   )
    //   .otherwise(callStepFunctionProcess)
    //   .afterwards();

    const returnOk = new Pass(this, 'PassState', {
      result: { value: 'ok' },
    });

    const machineDefinition = addRunningJobDynamo
      .next(incrQueueCount)
      .next(returnOk);

    const logGroup = new LogGroup(this, 'StepFunctionApiLogGroup', {
      logGroupName: `${appName}Process`,
      retention: RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    //Create the statemachine
    this.Machine = new StateMachine(this, 'StateMachineProcess', {
      definition: machineDefinition,
      stateMachineName: `${appName}Process`,
      timeout: Duration.minutes(5),
      stateMachineType: StateMachineType.EXPRESS,
      logs: {
        destination: logGroup,
        level: LogLevel.ALL,
      },
    });
  }
}
