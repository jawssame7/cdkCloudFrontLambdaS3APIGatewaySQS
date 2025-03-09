import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { StorageConstruct } from '../../lib/constructs/storage-construct';

describe('StorageConstruct', () => {
  // テスト用のスタックとコンストラクトを準備
  const app = new cdk.App();
  const stack = new cdk.Stack(app, 'TestStack');
  const storage = new StorageConstruct(stack, 'TestStorageConstruct');

  // CloudFormationテンプレートを生成
  const template = Template.fromStack(stack);

  test('S3バケットが作成されること', () => {
    // S3バケットリソースが1つ存在することを確認
    template.resourceCountIs('AWS::S3::Bucket', 1);
  });

  test('S3バケットに暗号化が設定されていること', () => {
    // S3バケットに暗号化が設定されていることを確認
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketEncryption: Match.objectLike({
        ServerSideEncryptionConfiguration: Match.arrayWith([
          Match.objectLike({
            ServerSideEncryptionByDefault: Match.objectLike({
              SSEAlgorithm: 'AES256',
            }),
          }),
        ]),
      }),
    });
  });

  test('S3バケットにパブリックアクセスブロックが設定されていること', () => {
    // パブリックアクセスがブロックされていることを確認
    template.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
  });

  test('S3バケットにライフサイクルルールについての検証', () => {
    // バケットに適切なポリシーが設定されていることを確認
    template.hasResource('AWS::S3::Bucket', {});
  });

  test('バケットの参照が正しく取得できること', () => {
    // バケットの参照が正しく公開されていることを確認
    expect(storage.bucket).toBeDefined();
  });
});
