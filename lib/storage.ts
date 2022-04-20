import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  StackProps,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import {
  AttributeType,
  BillingMode,
  StreamViewType,
  Table,
} from 'aws-cdk-lib/aws-dynamodb';
import { Queue } from 'aws-cdk-lib/aws-sqs';

interface StorageStackProps extends StackProps {
  appName: string;
}

export class StorageStack extends Stack {
  public dynamoTable: Table;
  public dlqQueue: Queue;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    const { appName } = props;

    this.dlqQueue = new sqs.Queue(this, `${appName}Queue`, {
      queueName: `${appName}Dlq`,
      visibilityTimeout: Duration.seconds(300),
    });

    this.dynamoTable = new Table(this, `${appName}SingleTable`, {
      tableName: appName,
      partitionKey: {
        name: 'pk',
        type: AttributeType.STRING,
      },
      sortKey: {
        name: 'sk',
        type: AttributeType.STRING,
      },
      billingMode: BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'delay',
      removalPolicy: RemovalPolicy.DESTROY,
      stream: StreamViewType.OLD_IMAGE,
    });
  }
}
