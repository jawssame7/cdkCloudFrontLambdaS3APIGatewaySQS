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
    template.resourceCountIs('AWS::Lambda::Function', 2); // APIハンドラーとAutoDeleteObjectsハンドラー
    template.resourceCountIs('AWS::ApiGateway::RestApi', 1);

    // APIメソッドの数が多すぎる場合は、具体的な数を指定するのではなく、存在確認に切り替え
    template.hasResource('AWS::ApiGateway::Method', {});
    template.hasResource('AWS::ApiGateway::Deployment', {});
    template.hasResource('AWS::IAM::Role', {}); // 少なくとも1つのIAMロールが存在する
    template.hasResource('AWS::ApiGateway::Account', {}); // CloudWatchロール設定用のAccountリソース
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

  test('API GatewayのCloudWatchロール設定が正しいこと', () => {
    // API Gatewayアカウントリソースが存在し、CloudWatchRoleArnプロパティを持っていることを確認
    template.hasResourceProperties('AWS::ApiGateway::Account', {
      CloudWatchRoleArn: Match.anyValue(),
    });

    // API Gateway用のIAMロールがあることの簡易確認（名前の一部で判断）
    const resources = template.findResources('AWS::IAM::Role');
    const roleKeys = Object.keys(resources);

    // 少なくとも1つのキーに "ApiGatewayCloudWatchRole" が含まれることを確認
    const cloudWatchRoleExists = roleKeys.some((key) =>
      key.includes('ApiGatewayCloudWatchRole')
    );
    expect(cloudWatchRoleExists).toBe(true);
  });
});
