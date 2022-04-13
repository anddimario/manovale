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

    // const addDelayedDynamo = new tasks.DynamoPutItem(
    //   this,
    //   'taskPutItemDelayed',
    //   {
    //     item: {
    //       pk: tasks.DynamoAttributeValue.fromString('job:delayed'),
    //       sk: tasks.DynamoAttributeValue.fromString(JsonPath.stringAt('$.requestContext.requestId')),
    //       job: tasks.DynamoAttributeValue.mapFromJsonPath('$.body'),
    //     },
    //     table: dynamoTable,
    //     inputPath: '$',
    //     resultPath: `$.Item`,
    //   }
    // );

    // const callStepFunctionProcess = new tasks.StepFunctionsStartExecution(this, 'ChildTask', {
    //   stateMachine: child,
    //   // integrationPattern: IntegrationPattern.RUN_JOB,
    //   input: TaskInput.fromObject({
    //     token: JsonPath.taskToken,
    //     foo: 'bar',
    //   }),
    //   name: 'MyExecutionName',
    // });

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

    const waitForFileCreation = new Wait(this, 'Wait', {
      time: WaitTime.duration(Duration.seconds(10)),
    });
    const machineDefinition = waitForFileCreation.next(returnOk);

    const logGroup = new LogGroup(this, 'StepFunctionApiLogGroup', {
        logGroupName: `${appName}Process`,
        retention: RetentionDays.ONE_MONTH,
        removalPolicy: RemovalPolicy.DESTROY
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
