import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import {
  Choice,
  Condition,
  IntegrationPattern,
  JsonPath,
  LogLevel,
  Pass,
  StateMachine,
  StateMachineType,
  TaskInput,
} from 'aws-cdk-lib/aws-stepfunctions';
import { Construct } from 'constructs';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';

interface StepFunctionApiStackProps extends StackProps {
  appName: string;
  dynamoTable: Table;
  processMachine: StateMachine
}

export class StepFunctionApiStack extends Stack {
  public Machine: StateMachine;

  constructor(scope: Construct, id: string, props: StepFunctionApiStackProps) {
    super(scope, id, props);

    const { appName, dynamoTable, processMachine } = props;

    const addDelayedDynamo = new tasks.DynamoPutItem(
      this,
      'taskPutItemDelayed',
      {
        item: {
          pk: tasks.DynamoAttributeValue.fromString('job:delayed'),
          sk: tasks.DynamoAttributeValue.fromString(JsonPath.stringAt('$.body.id')),
          job: tasks.DynamoAttributeValue.mapFromJsonPath('$.body'),
          delay: tasks.DynamoAttributeValue.numberFromString(JsonPath.stringAt('$.body.delay')),
        },
        table: dynamoTable,
        inputPath: '$',
        resultPath: `$.Item`,
      }
    );

    const callStepFunctionProcess = new tasks.StepFunctionsStartExecution(this, 'ChildTask', {
      stateMachine: processMachine,
      // integrationPattern: IntegrationPattern.RUN_JOB,
      // input: TaskInput.fromObject({
      //   token: JsonPath.taskToken,
      //   foo: 'bar',
      // }),
      name: `${appName}Process`,
    });

    // Choice condition if it's a delayed job
    const checkDelay = new Choice(this, 'Is it a delayed job?')
      .when(
        Condition.isPresent('$.body.delay'),
        addDelayedDynamo
      )
      .otherwise(callStepFunctionProcess)
      .afterwards();

    const returnOk = new Pass(this, 'PassState', {
        result: { value: 'ok' },
      });

    const machineDefinition = checkDelay
    .next(returnOk);

    const logGroup = new LogGroup(this, 'StepFunctionApiLogGroup', {
      logGroupName: `${appName}Api`,
      retention: RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY
    });

    //Create the statemachine
    this.Machine = new StateMachine(this, 'StateMachineApi', {
      definition: machineDefinition,
      stateMachineName: `${appName}Api`,
      timeout: Duration.minutes(5),
      stateMachineType: StateMachineType.EXPRESS,
      logs: {
        destination: logGroup,
        level: LogLevel.ALL,
      },
    });
  }
}
