import codepipeline = require('@aws-cdk/aws-codepipeline');
import { App, Stack, StackProps } from '@aws-cdk/cdk';
import { BootstrapPipelineSource, DeployStackAction } from './bootstrap';
import { CdkWorkshopStack } from './workshop-stack';
import sns = require('@aws-cdk/aws-sns');

export interface WorkshopPipelineProps extends StackProps {
  workshopStack: CdkWorkshopStack
}

export class WorkshopPipeline extends Stack {
  constructor(app: App, id: string, props: WorkshopPipelineProps) {
    super(app, id, props);

    const source = new BootstrapPipelineSource(this, 'Source', {
      pipeline: 'cdk-workshop'
    });

    const deploy = new DeployStackAction(this, 'DeployWorkshop', {
      source,
      stack: props.workshopStack,
      admin: true
    });

    const deployStack2 = new DeployStackAction(this, 'DeployRandomStack', {
      source,
      stack: new RandomStack(app, 'RandomStack'),
      admin: true
    });

    new codepipeline.Pipeline(this, 'Pipeline', {
      stages: [
        { name: 'Source', actions: [ source ] },
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