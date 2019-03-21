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

    const deploy = new DeployStackAction(this, 'DeployWorkshop', {
      stack: props.workshopStack,
      admin: true
    });

    const deployStack2 = new DeployStackAction(this, 'DeployRandomStack', {
      stack: new RandomStack(app, 'RandomStack'),
      admin: true
    });

    new ApplicationPipeline(this, 'Pipeline', {
      pipeline: 'cdk-workshop',
      stages: [
        { name: 'DeployWorkshop', actions: [ deploy, deployStack2 ] }
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