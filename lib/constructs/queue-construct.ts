import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as iam from 'aws-cdk-lib/aws-iam';

export interface QueueConstructProps {
  /**
   * キューの可視性タイムアウト
   * @default - 300秒
   */
  visibilityTimeout?: cdk.Duration;

  /**
   * メッセージの受信待機時間（ロングポーリング）
   * @default - 20秒
   */
  receiveMessageWaitTime?: cdk.Duration;

  /**
   * キューの削除ポリシー
   * @default - DESTROY (スタック削除時にキューも削除)
   */
  removalPolicy?: cdk.RemovalPolicy;
}

/**
 * アプリケーションのメッセージキューを管理するコンストラクト
 */
export class QueueConstruct extends Construct {
  /**
   * SQSキュー
   */
  public readonly queue: sqs.Queue;

  constructor(scope: Construct, id: string, props: QueueConstructProps = {}) {
    super(scope, id);

    // デフォルト値の設定
    const visibilityTimeout =
      props.visibilityTimeout || cdk.Duration.seconds(300);
    const receiveMessageWaitTime =
      props.receiveMessageWaitTime || cdk.Duration.seconds(20);
    const removalPolicy = props.removalPolicy || cdk.RemovalPolicy.DESTROY;

    // SQSキューを作成
    this.queue = new sqs.Queue(this, 'MessageQueue', {
      visibilityTimeout: visibilityTimeout,
      receiveMessageWaitTime: receiveMessageWaitTime,
      retentionPeriod: cdk.Duration.days(14), // メッセージの保持期間（最大14日）
      removalPolicy: removalPolicy,
    });

    // 出力値の定義
    new cdk.CfnOutput(this, 'QueueUrl', {
      value: this.queue.queueUrl,
      description: 'SQS queue URL',
    });

    new cdk.CfnOutput(this, 'QueueArn', {
      value: this.queue.queueArn,
      description: 'SQS queue ARN',
    });
  }

  /**
   * キューへのメッセージ送信権限を付与
   */
  public grantSendMessages(grantee: iam.IGrantable): iam.Grant {
    return this.queue.grantSendMessages(grantee);
  }

  /**
   * キューからのメッセージ受信・削除権限を付与
   */
  public grantConsumeMessages(grantee: iam.IGrantable): iam.Grant {
    return this.queue.grantConsumeMessages(grantee);
  }
}
