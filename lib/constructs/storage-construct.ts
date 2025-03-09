import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';

export interface StorageConstructProps {
  /**
   * バケットの削除ポリシー
   * @default - DESTROY (スタック削除時にバケットも削除)
   */
  removalPolicy?: cdk.RemovalPolicy;

  /**
   * バケットのライフサイクルルール
   */
  lifecycleRules?: s3.LifecycleRule[];
}

/**
 * アプリケーションのデータストレージを管理するコンストラクト
 */
export class StorageConstruct extends Construct {
  /**
   * S3バケット
   */
  public readonly bucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: StorageConstructProps = {}) {
    super(scope, id);

    // デフォルト値の設定
    const removalPolicy = props.removalPolicy || cdk.RemovalPolicy.DESTROY;

    // S3バケットを作成
    this.bucket = new s3.Bucket(this, 'DataBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: false,
      removalPolicy: removalPolicy,
      autoDeleteObjects: removalPolicy === cdk.RemovalPolicy.DESTROY,

      // デフォルトのライフサイクルルールを設定 (もし指定されていれば上書き)
      lifecycleRules: props.lifecycleRules || [
        {
          // 不完全なマルチパートアップロードを7日後に削除
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
          // 非現行バージョンを90日後に移行
          noncurrentVersionExpiration: cdk.Duration.days(90),
        },
      ],

      // バケットのセキュリティを強化
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
    });

    // 出力値の定義
    new cdk.CfnOutput(this, 'BucketName', {
      value: this.bucket.bucketName,
      description: 'S3 bucket name for data storage',
    });
  }

  /**
   * バケットへの読み書き権限を付与
   */
  public grantReadWrite(grantee: iam.IGrantable): iam.Grant {
    return this.bucket.grantReadWrite(grantee);
  }
}
