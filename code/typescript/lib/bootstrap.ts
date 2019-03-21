import codebuild = require('@aws-cdk/aws-codebuild');
import iam = require('@aws-cdk/aws-iam');
import codepipeline_api = require('@aws-cdk/aws-codepipeline-api');
import s3 = require('@aws-cdk/aws-s3');
import { Construct, Fn, Stack } from '@aws-cdk/cdk';
import codepipeline = require('@aws-cdk/aws-codepipeline');

export interface ApplicationPipelineProps extends codepipeline.PipelineProps {
  bootstrap: string;
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
      pipeline: props.bootstrap
    });

    this.source = source;

    this.addStage({
      name: 'Source',
      actions: [ source ]
    });

    for (const stage of stages) {
      this.addStage(stage);
    }
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
   * Grant administrator permissions to the deployment action. This is likely to
   * be needed in order to deploy arbitrary infrastructure into your account.
   *
   * You can also grant specific permissions to the execution role through
   * `addToRolePolicy` or by using a grant method on a resource and referencing
   * the `role`.
   */
  admin: boolean;
}

export class DeployStackAction extends codepipeline_api.Action {
  private readonly stackName: string;
  private _buildAction: codebuild.PipelineBuildAction;
  private _project: codebuild.Project;
  private readonly admin: boolean;

  constructor(props: DeployStackActionProps) {
    super({
      category: codepipeline_api.ActionCategory.Build,
      provider: 'CodeBuild',
      artifactBounds: { minInputs: 1, maxInputs: 1, minOutputs: 0, maxOutputs: 0 },
      actionName: props.stack.name,
    });

    this.stackName = props.stack.name;
    this.admin = props.admin;
  }

  public get configuration() {
    return this.buildAction.configuration;
  }

  public set configuration(_: string) {
    return;
  }

  private get buildAction() {
    if (!this._buildAction) {
      throw new Error(`Action not bound to pipeline`);
    }

    return this._buildAction;
  }

  public get project() {
    if (!this._project) {
      throw new Error(`Action not bound to pipeline`);
    }

    return this._project;
  }

  public bind(stage: codepipeline_api.IStage, scope: Construct) {
    if (!ApplicationPipeline.isApplicationPipeline(stage.pipeline)) {
      throw new Error(`DeployStackAction must be added to an ApplicationPipeline`);
    }

    const source = stage.pipeline.source;
    if (!source) {
      throw new Error(`Cannot find source of ApplicationPipeline`);
    }

    const version = source.pipelineAttributes.toolkitVersion;
    const stackName = this.stackName;

    const project = new codebuild.PipelineProject(scope, `${stackName}Deployment`, {
      environment: {
        buildImage: codebuild.LinuxBuildImage.UBUNTU_14_04_NODEJS_10_1_0,
      },
      buildSpec: {
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
      }
    });

    this.addInputArtifact(source.outputArtifact);

    this._project = project;

    this._buildAction = new codebuild.PipelineBuildAction({
      actionName: this.stackName,
      inputArtifact: source.outputArtifact,
      project,
    });

    (this._buildAction as any).bind(stage, scope);

    if (this.admin) {
      this.addToRolePolicy(new iam.PolicyStatement()
        .addAllResources()
        .addAction('*'));
    }
  }

  public addToRolePolicy(statement: iam.PolicyStatement) {
    this.project.addToRolePolicy(statement);
  }
}

export interface BootstrapPipelineAttributes {
  readonly bucketName: string;
  readonly objectKey: string;
  readonly toolkitVersion: string;
}