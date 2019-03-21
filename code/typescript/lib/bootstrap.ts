import codebuild = require('@aws-cdk/aws-codebuild');
import iam = require('@aws-cdk/aws-iam');
import codepipeline_api = require('@aws-cdk/aws-codepipeline-api');
import s3 = require('@aws-cdk/aws-s3');
import { Construct, Fn, Stack, Token } from '@aws-cdk/cdk';
import codepipeline = require('@aws-cdk/aws-codepipeline');

export interface ApplicationPipelineProps extends codepipeline.PipelineProps {
  pipeline: string;
}

const APPLICATION_PIPELINE_MARKER = '4501D193-76B7-45D6-836E-3E657F21AD69';

export class ApplicationPipeline extends codepipeline.Pipeline {
  public static isApplicationPipeline(obj: any): obj is ApplicationPipeline {
    return (obj as any)._marker === APPLICATION_PIPELINE_MARKER;
  }

  public readonly source: BootstrapPipelineSource;

  constructor(scope: Construct, id: string, props: ApplicationPipelineProps) {
    super(scope, id);

    Object.defineProperty(this, '_marker', { value: APPLICATION_PIPELINE_MARKER });

    const stages = props.stages || [];
    delete props.stages;

    const source = new BootstrapPipelineSource(this, 'Source', {
      pipeline: props.pipeline
    });

    super(scope, id);

    this.addStage({
      name: 'Source',
      actions: [ source ]
    });

    for (const stage of stages) {
      this.addStage(stage);
    }

    this.source = source;
  }
}

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
  /**
   * The stack to deploy
   */
  stack: Stack;

  /**
   * Grants administrator permissions to the action.
   */
  admin: boolean;
}

class LazyWrappedArtifact extends codepipeline_api.Artifact {
  constructor(fn: () => codepipeline_api.Artifact) {
    super(new Token(() => fn().artifactName).toString());
  }
}

export class DeployStackAction extends codebuild.PipelineBuildAction {
  private readonly project: codebuild.PipelineProject;
  private readonly stackName: string;
  private _source?: BootstrapPipelineSource;

  constructor(scope: Construct, id: string, props: DeployStackActionProps) {
    const group = new Construct(scope, id);

    const project = new codebuild.PipelineProject(group, 'Project', {
      environment: {
        buildImage: codebuild.LinuxBuildImage.UBUNTU_14_04_NODEJS_10_1_0,
      },
      buildSpec: new Token(() => this.renderBuildSpec())
    });

    super({
      actionName: 'Deploy',
      project,
      inputArtifact: new LazyWrappedArtifact(() => this.source.outputArtifact)
    });

    this.project = project;
    this.stackName = props.stack.stackName;

    if (props.admin) {
      this.addToRolePolicy(new iam.PolicyStatement()
        .addAllResources()
        .addAction('*'));
    }
  }

  public get source() {
    if (!this._source) {
      throw new Error(`DeployStackAction must be added to a pipeline`);
    }
    return this._source;
  }

  public bind(stage: codepipeline_api.IStage, _scope: Construct) {
    if (!ApplicationPipeline.isApplicationPipeline(stage.pipeline)) {
      throw new Error(`DeployStackAction must be added to an ApplicationPipeline`);
    }

    this._source = stage.pipeline.source;
  }

  public addToRolePolicy(statement: iam.PolicyStatement) {
    this.project.addToRolePolicy(statement);
  }

  private renderBuildSpec() {
    const version = this.source.pipelineAttributes.toolkitVersion;
    const stackName = this.stackName;

    return {
      version: '0.2',
      phases: {
        install: {
          commands: [
            `npx npm@latest ci`
          ]
        },
        build: {
          commands: [
            `npx --package aws-cdk@${version} -- cdk deploy --require-approval=never ${stackName}`
          ]
        }
      }
    };
  }
}

export interface BootstrapPipelineAttributes {
  readonly bucketName: string;
  readonly objectKey: string;
  readonly toolkitVersion: string;
}