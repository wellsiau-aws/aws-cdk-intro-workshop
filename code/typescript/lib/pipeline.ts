import { App, Stack, StackProps } from '@aws-cdk/cdk';
import { DeployStackAction, ApplicationPipeline } from './bootstrap';
import { CdkWorkshopStack } from './workshop-stack';
import sns = require('@aws-cdk/aws-sns');

export interface WorkshopPipelineProps extends StackProps {
  workshopStack: CdkWorkshopStack
}

export class WorkshopPipeline extends Stack {
  constructor(app: App, id: string, props: WorkshopPipelineProps) {
    super(app, id, props);

    new ApplicationPipeline(this, 'Pipeline', {
      bootstrap: 'cdk-workshop',
      stages: [
        {
          name: 'DeployWorkshop',
          actions: [
            new DeployStackAction({ stack: props.workshopStack, admin: true }),
            new DeployStackAction({ stack: new RandomStack(app, 'RandomStack'), admin: true })
          ]
        }
      ]
    });
  }
}

class RandomStack extends Stack {
  constructor(app: App, id: string) {
    super(app, id);

    new sns.Topic(this, 'MyTopic');
  }
}