import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from 'path';
import { CfnAccount } from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';

// コンストラクトのインポート
import { StorageConstruct } from './constructs/storage-construct';
import { QueueConstruct } from './constructs/queue-construct';
import { ApiConstruct } from './constructs/api-construct';
import { WebsiteConstruct } from './constructs/website-construct';

/**
 * メインスタック用のプロパティインターフェース
 */
export interface CdkCloudFrontLambdaS3APIGatewaySQSStackProps
  extends cdk.StackProps {
  /**
   * SQSを使うかどうかのフラグ
   */
  useSqs?: boolean;
}

/**
 * メインCDKスタック
 */
export class CdkCloudFrontLambdaS3APIGatewaySQSStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    props?: CdkCloudFrontLambdaS3APIGatewaySQSStackProps
  ) {
    super(scope, id, props);

    // SQSを使うかどうかのフラグ（デフォルトはfalse）
    const useSqs = props?.useSqs ?? false;

    // ストレージコンストラクト（データ保存用S3バケット）
    const storage = new StorageConstruct(this, 'Storage', {
      removalPolicy: cdk.RemovalPolicy.DESTROY, // デモ用なので削除可能に設定
    });

    // SQSキューコンストラクト（useSqsがtrueの場合のみ作成）
    let queue;
    if (useSqs) {
      queue = new QueueConstruct(this, 'Queue', {
        visibilityTimeout: cdk.Duration.seconds(300),
        receiveMessageWaitTime: cdk.Duration.seconds(20), // ロングポーリング設定
        removalPolicy: cdk.RemovalPolicy.DESTROY, // デモ用なので削除可能に設定
      });
    }

    // APIコンストラクト（API GatewayとLambda関数）
    const api = new ApiConstruct(this, 'Api', {
      lambdaEntryPath: path.join(__dirname, '../lambda/api-handler.ts'),
      storageBucket: storage.bucket,
      queue: useSqs && queue ? queue.queue : undefined,
      lambdaTimeout: cdk.Duration.seconds(30),
      lambdaMemorySize: 256,
    });

    // ウェブサイトコンストラクト（S3バケットとCloudFront）
    const website = new WebsiteConstruct(this, 'Website', {
      websiteSourcePath: path.join(__dirname, '../website'),
      apiGateway: api.api,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // デモ用なので削除可能に設定
    });

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
  }
}
