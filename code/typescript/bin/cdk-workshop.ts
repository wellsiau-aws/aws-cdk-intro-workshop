#!/usr/bin/env node
import cdk = require('@aws-cdk/cdk');
import { WorkshopPipeline } from '../lib/pipeline';
import { CdkWorkshopStack } from '../lib/workshop-stack';

const app = new cdk.App();

const workshopStack = new CdkWorkshopStack(app, 'CdkWorkshopStack');

new WorkshopPipeline(app, 'Pipeline', {
  workshopStack
});

app.run();
