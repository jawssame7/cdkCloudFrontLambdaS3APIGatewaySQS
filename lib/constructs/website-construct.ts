import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as path from 'path';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';

export interface WebsiteConstructProps {
  /**
   * ウェブサイトのソースパス
   */
  websiteSourcePath: string;

  /**
   * API GatewayへのOrigin設定（APIリクエストのルーティング用）
   */
  apiGateway?: apigateway.RestApi;

  /**
   * バケットの削除ポリシー
   * @default - DESTROY (スタック削除時にバケットも削除)
   */
  removalPolicy?: cdk.RemovalPolicy;
}

/**
 * 静的ウェブサイトとCDNを管理するコンストラクト
 */
export class WebsiteConstruct extends Construct {
  /**
   * ウェブサイト用S3バケット
   */
  public readonly bucket: s3.Bucket;

  /**
   * CloudFrontディストリビューション
   */
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: WebsiteConstructProps) {
    super(scope, id);

    // デフォルト値の設定
    const removalPolicy = props.removalPolicy || cdk.RemovalPolicy.DESTROY;

    // ウェブサイト用S3バケットの作成
    this.bucket = new s3.Bucket(this, 'WebsiteBucket', {
      publicReadAccess: false, // CloudFrontからのみアクセス可能
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: removalPolicy,
      autoDeleteObjects: removalPolicy === cdk.RemovalPolicy.DESTROY,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
    });

    // バケットポリシーを設定して、CloudFrontからのアクセスを許可
    this.bucket.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [this.bucket.arnForObjects('*')],
        principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
        conditions: {
          StringEquals: {
            'AWS:SourceArn': `arn:aws:cloudfront::${
              cdk.Stack.of(this).account
            }:distribution/*`,
          },
        },
      })
    );

    // APIリクエスト用のポリシーを作成
    const apiOriginRequestPolicy = new cloudfront.OriginRequestPolicy(
      this,
      'ApiOriginRequestPolicy',
      {
        headerBehavior: cloudfront.OriginRequestHeaderBehavior.allowList(
          'Content-Type',
          'X-Api-Key',
          'Origin',
          'Access-Control-Request-Method',
          'Access-Control-Request-Headers'
        ),
        queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.all(),
        cookieBehavior: cloudfront.OriginRequestCookieBehavior.none(),
      }
    );

    // CloudFrontディストリビューションの作成
    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket),
        compress: true,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: props.apiGateway
        ? {
            '/api/*': {
              origin: new origins.RestApiOrigin(props.apiGateway),
              allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
              cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
              originRequestPolicy: apiOriginRequestPolicy,
              // 組み込みのCORSサポートを使用
              responseHeadersPolicy:
                cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS,
            },
          }
        : undefined,
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
    });

    // S3にウェブサイトファイルをデプロイ
    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources: [s3deploy.Source.asset(props.websiteSourcePath)],
      destinationBucket: this.bucket,
      distribution: this.distribution,
      distributionPaths: ['/*'],
      // デプロイメント用のカスタムロールを作成
      role: new iam.Role(this, 'WebsiteDeploymentRole', {
        assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
        inlinePolicies: {
          CloudFrontInvalidation: new iam.PolicyDocument({
            statements: [
              new iam.PolicyStatement({
                actions: [
                  'cloudfront:CreateInvalidation',
                  'cloudfront:GetInvalidation',
                ],
                resources: ['*'],
              }),
            ],
          }),
        },
        // Lambda実行に必要な基本的な権限も追加
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName(
            'service-role/AWSLambdaBasicExecutionRole'
          ),
        ],
      }),
    });

    // 出力値の定義
    new cdk.CfnOutput(this, 'WebsiteBucketName', {
      value: this.bucket.bucketName,
      description: 'S3 bucket name for the website',
    });

    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: this.distribution.distributionDomainName,
      description: 'CloudFront distribution domain name',
    });
  }
}
