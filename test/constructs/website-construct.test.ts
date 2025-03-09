import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as path from 'path';
import { WebsiteConstruct } from '../../lib/constructs/website-construct';

describe('WebsiteConstruct', () => {
  // テスト用のスタックとコンストラクトを準備
  const app = new cdk.App();
  const stack = new cdk.Stack(app, 'TestStack');

  // テスト対象のWebsiteConstructを作成
  const website = new WebsiteConstruct(stack, 'TestWebsiteConstruct', {
    websiteSourcePath: path.join(__dirname, '../../website'),
  });

  // CloudFormationテンプレートを生成
  const template = Template.fromStack(stack);

  test('S3バケットが作成されること', () => {
    // S3バケットリソースが存在することを確認
    template.resourceCountIs('AWS::S3::Bucket', 1);
  });

  test('CloudFrontディストリビューションが作成されること', () => {
    // CloudFrontディストリビューションが存在することを確認
    template.resourceCountIs('AWS::CloudFront::Distribution', 1);
  });

  test('S3アクセス用の設定が作成されること', () => {
    // バケットポリシーが存在することを確認
    template.hasResource('AWS::S3::BucketPolicy', {});
  });

  test('CloudFrontディストリビューションに基本設定が適用されていること', () => {
    // 基本的な設定だけ検証
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        DefaultRootObject: 'index.html',
        Enabled: true,
      },
    });
  });

  test('CloudFrontディストリビューションにエラーページが設定されていること', () => {
    // エラーページが設定されていることを確認
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        CustomErrorResponses: Match.arrayWith([
          Match.objectLike({
            ErrorCode: 404,
            ResponseCode: 200,
            ResponsePagePath: '/index.html',
          }),
        ]),
      }),
    });
  });

  test('BucketDeploymentが設定されていること', () => {
    // CustomResourceが存在することを確認（S3DeploymentはCustomResourceとして実装されている）
    template.hasResource('Custom::CDKBucketDeployment', {});
  });

  test('コンストラクトから適切なリソースの参照が取得できること', () => {
    // バケットとディストリビューションの参照が正しく公開されていることを確認
    expect(website.bucket).toBeDefined();
    expect(website.distribution).toBeDefined();
  });
});
