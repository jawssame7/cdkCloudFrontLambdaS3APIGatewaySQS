import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { CfnAccount } from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as path from 'path';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';

export interface ApiConstructProps {
  /**
   * APIハンドラーLambda関数のエントリーポイント
   */
  lambdaEntryPath: string;

  /**
   * ストレージバケットの参照
   */
  storageBucket: s3.Bucket;

  /**
   * SQSキューの参照（オプション）
   */
  queue?: sqs.Queue;

  /**
   * Lambda関数のタイムアウト
   * @default - 30秒
   */
  lambdaTimeout?: cdk.Duration;

  /**
   * Lambda関数のメモリサイズ
   * @default - 128 MB
   */
  lambdaMemorySize?: number;
}

/**
 * APIとバックエンド処理を管理するコンストラクト
 */
export class ApiConstruct extends Construct {
  /**
   * API Gateway
   */
  public readonly api: apigateway.RestApi;

  /**
   * Lambda関数
   */
  public readonly handler: lambda.Function;

  constructor(scope: Construct, id: string, props: ApiConstructProps) {
    super(scope, id);

    // デフォルト値の設定
    const lambdaTimeout = props.lambdaTimeout || cdk.Duration.seconds(30);
    const lambdaMemorySize = props.lambdaMemorySize || 128;

    // Lambda関数用のIAMロールを作成
    const lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole'
        ),
      ],
    });

    // S3バケットへのアクセス権限を追加
    props.storageBucket.grantReadWrite(lambdaRole);

    // SQSキューへのアクセス権限を追加（指定されている場合）
    if (props.queue) {
      props.queue.grantSendMessages(lambdaRole);
    }

    // CloudWatch Logsへのアクセス権を持つロールを作成
    const apiGatewayCloudWatchRole = new iam.Role(
      this,
      'ApiGatewayCloudWatchRole',
      {
        assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName(
            'service-role/AmazonAPIGatewayPushToCloudWatchLogs'
          ),
        ],
      }
    );

    // API GatewayアカウントにCloudWatchロールを設定
    new CfnAccount(this, 'ApiGatewayAccount', {
      cloudWatchRoleArn: apiGatewayCloudWatchRole.roleArn,
    });

    // Lambda関数の作成
    this.handler = new NodejsFunction(this, 'ApiHandler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'handler',
      entry: props.lambdaEntryPath,
      role: lambdaRole,
      environment: {
        BUCKET_NAME: props.storageBucket.bucketName,
        QUEUE_URL: props.queue ? props.queue.queueUrl : '',
      },
      bundling: {
        externalModules: ['@aws-sdk/client-s3', '@aws-sdk/client-sqs'],
        sourceMap: false,
        minify: true,
      },
      timeout: lambdaTimeout,
      memorySize: lambdaMemorySize,
      architecture: lambda.Architecture.ARM_64,
      tracing: lambda.Tracing.ACTIVE,
    });

    // API Gatewayの作成
    this.api = new apigateway.RestApi(this, 'ApiGateway', {
      restApiName: 'CDK Sample API',
      description: 'API for the CDK sample application',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
      deployOptions: {
        stageName: 'prod',
        tracingEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
      },
    });

    // APIリソースとメソッドの設定
    const apiResource = this.api.root.addResource('api');

    // ファイル操作用のリソース
    const filesResource = apiResource.addResource('files');
    filesResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(this.handler)
    );

    const fileResource = filesResource.addResource('{fileName}');
    fileResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(this.handler)
    );

    // SQS用のリソース（SQSキューが指定されている場合のみ作成）
    if (props.queue) {
      const queueResource = apiResource.addResource('queue');
      queueResource.addMethod(
        'POST',
        new apigateway.LambdaIntegration(this.handler)
      );
    }

    // 出力値の定義
    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: this.api.url,
      description: 'API Gateway URL',
    });
  }
}
