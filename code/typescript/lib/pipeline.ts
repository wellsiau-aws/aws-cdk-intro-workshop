import codepipeline = require('@aws-cdk/aws-codepipeline');
import { App, Stack, StackProps } from '@aws-cdk/cdk';
import { BootstrapPipelineSource, DeployStackAction } from './bootstrap';
import { CdkWorkshopStack } from './workshop-stack';

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

    new codepipeline.Pipeline(this, 'Pipeline', {
      stages: [
        { name: 'Source', actions: [ source ] },
        { name: 'DeployWorkshop', actions: [ deploy ] }
      ]
    });
  }
}