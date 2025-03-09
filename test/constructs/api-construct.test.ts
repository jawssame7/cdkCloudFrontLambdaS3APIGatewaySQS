import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as path from 'path';
import { ApiConstruct } from '../../lib/constructs/api-construct';
import { StorageConstruct } from '../../lib/constructs/storage-construct';

describe('ApiConstruct', () => {
  // テスト用のスタックとコンストラクトを準備
  const app = new cdk.App();
  const stack = new cdk.Stack(app, 'TestStack');

  // 依存するStorageConstructを作成
  const storage = new StorageConstruct(stack, 'TestStorage');

  // テスト対象のApiConstructを作成
  const api = new ApiConstruct(stack, 'TestApiConstruct', {
    lambdaEntryPath: path.join(__dirname, '../../lambda/api-handler.ts'),
    storageBucket: storage.bucket,
    lambdaTimeout: cdk.Duration.seconds(60),
    lambdaMemorySize: 256,
  });

  // CloudFormationテンプレートを生成
  const template = Template.fromStack(stack);

  test('Lambda関数とAPI Gateway関連リソースが作成されること', () => {
    // 主要リソースが存在することを確認
    template.hasResource('AWS::Lambda::Function', {});
    template.hasResource('AWS::ApiGateway::RestApi', {});
    template.hasResource('AWS::ApiGateway::Method', {});
    template.hasResource('AWS::ApiGateway::Deployment', {});
    template.hasResource('AWS::IAM::Role', {});
  });

  test('Lambda関数に環境変数とIAMロールが設定されていること', () => {
    // Lambda関数に基本的な設定と環境変数が含まれていることを確認
    template.hasResourceProperties('AWS::Lambda::Function', {
      Handler: 'index.handler',
      Runtime: 'nodejs18.x',
      Environment: Match.objectLike({
        Variables: Match.objectLike({
          BUCKET_NAME: Match.anyValue(),
        }),
      }),
    });
  });

  test('APIリソースが正しく取得できること', () => {
    // APIとハンドラーの参照が正しく公開されていることを確認
    expect(api.api).toBeDefined();
    expect(api.handler).toBeDefined();
  });
});
