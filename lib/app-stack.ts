import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { StateMachine } from 'aws-cdk-lib/aws-stepfunctions';
import { StepFunctionsRestApi } from 'aws-cdk-lib/aws-apigateway';

interface AppStackProps extends StackProps {
  stateMachine: StateMachine;
  stageName: string;
  appName: string;
}

export class AppStack extends Stack {
  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    const { stateMachine, appName } = props;

    const apiLaunch = new StepFunctionsRestApi(this, 'StepFunctionsRestApi', {
      stateMachine,
      restApiName: `${appName}StepFunction`,
    });

    // output
    new CfnOutput(this, 'apiUrlJob', {
      value: apiLaunch.url || '',
    });
  }
}
