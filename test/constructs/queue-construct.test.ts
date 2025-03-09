import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { QueueConstruct } from '../../lib/constructs/queue-construct';

describe('QueueConstruct', () => {
  // テスト用のスタックとコンストラクトを準備
  const app = new cdk.App();
  const stack = new cdk.Stack(app, 'TestStack');

  // テスト対象のQueueConstructを作成
  const queueConstruct = new QueueConstruct(stack, 'TestQueueConstruct', {
    visibilityTimeout: cdk.Duration.seconds(120),
    receiveMessageWaitTime: cdk.Duration.seconds(10),
  });

  // CloudFormationテンプレートを生成
  const template = Template.fromStack(stack);

  test('SQSキューが作成されること', () => {
    // SQSキューリソースが存在することを確認
    template.resourceCountIs('AWS::SQS::Queue', 1);
  });

  test('SQSキューに適切なパラメータが設定されていること', () => {
    // キューのパラメータを確認
    template.hasResourceProperties('AWS::SQS::Queue', {
      VisibilityTimeout: 120,
      ReceiveMessageWaitTimeSeconds: 10,
    });
  });

  test('SQSキューの保持期間設定を検証', () => {
    // 保持期間の設定を確認（実装に依存しない検証）
    template.hasResourceProperties('AWS::SQS::Queue', {
      MessageRetentionPeriod: Match.anyValue(),
    });
  });

  test('キューの参照が正しく取得できること', () => {
    // キューの参照が正しく公開されていることを確認
    expect(queueConstruct.queue).toBeDefined();
  });

  test('キューのアウトプット値を検証', () => {
    // スタックからキューの出力値が公開されていることを確認
    template.hasOutput(
      '*',
      Match.objectLike({
        Description: Match.stringLikeRegexp('.*SQS.*'),
      })
    );
  });
});
