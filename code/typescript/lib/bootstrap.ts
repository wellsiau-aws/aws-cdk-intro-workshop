import codebuild = require('@aws-cdk/aws-codebuild');
import s3 = require('@aws-cdk/aws-s3');
import { Construct, Fn, Stack } from '@aws-cdk/cdk';

export interface BootstrapPipelineSourceProps {
  pipeline: string;
}

export class BootstrapPipelineSource extends s3.PipelineSourceAction {
  public readonly pipelineAttributes: BootstrapPipelineAttributes;

  constructor(scope: Construct, id: string, props: BootstrapPipelineSourceProps) {
    const exportPrefix = `cdk-pipeline:${props.pipeline}`;

    const attributes: BootstrapPipelineAttributes = {
      bucketName: Fn.importValue(`${exportPrefix}-bucket`),
      objectKey: Fn.importValue(`${exportPrefix}-object-key`),
      toolkitVersion: Fn.importValue(`${exportPrefix}-toolkit-version`),
    };

    const bucket = s3.Bucket.import(scope, `${id}/Bucket`, { bucketName: attributes.bucketName });
    super({
      actionName: 'Pull',
      bucket,
      bucketKey: attributes.objectKey,
      outputArtifactName: 'CloudAssembly'
    });

    this.pipelineAttributes = attributes;
  }
}

export interface DeployStackActionProps {
  stack: Stack;
  source: BootstrapPipelineSource;
}

export class DeployStackAction extends codebuild.PipelineBuildAction {
  constructor(scope: Construct, id: string, props: DeployStackActionProps) {
    const group = new Construct(scope, id);
    const version = props.source.pipelineAttributes.toolkitVersion;
    const stackName = props.stack.name;

    const project = new codebuild.PipelineProject(group, 'Project', {
      environment: {
        buildImage: codebuild.LinuxBuildImage.UBUNTU_14_04_NODEJS_10_1_0,
      },
      buildSpec: {
        version: '0.2',
        phases: {
          install: {
            commands: [
              `find .`,
              `npx npm@latest ci`
            ]
          },
          build: {
            commands: [
              `npx --package aws-cdk@${version} -- cdk deploy --require-approval=never ${stackName}`
            ]
          }
        }
      }
    });

    super({
      actionName: 'Deploy',
      project,
      inputArtifact: props.source.outputArtifact,
    });
  }
}

export interface BootstrapPipelineAttributes {
  readonly bucketName: string;
  readonly objectKey: string;
  readonly toolkitVersion: string;
}