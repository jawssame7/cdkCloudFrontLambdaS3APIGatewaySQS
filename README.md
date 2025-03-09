# AWS CDK Lambda-S3-CloudFront サンプルプロジェクト

このプロジェクトは、AWS CDK を使用して以下の AWS リソースをデプロイするサンプルです：

- **Lambda**: API リクエストを処理するサーバーレス関数
- **S3**: 静的ウェブサイトファイルとユーザーデータの保存
- **CloudFront**: コンテンツ配信と API リクエストのルーティング
- **API Gateway**: RESTful API のエンドポイント
- **SQS** (オプション): メッセージキュー

## アーキテクチャ

このプロジェクトは次のアーキテクチャを実装しています：

1. 静的ウェブサイトは S3 に保存され、CloudFront を通じて配信されます
2. `/api/*` パスへのリクエストは API Gateway を通じて Lambda 関数にルーティングされます
3. Lambda 関数は S3 バケットにアクセスしてファイルの読み書きができます
4. オプションで SQS キューを有効にすると、Lambda 関数からメッセージを送信できます

## コンストラクト構造

このプロジェクトは CDK のベストプラクティスに従って、以下の再利用可能なコンストラクトに分割されています：

- **StorageConstruct**: データ保存用の S3 バケットを管理
- **QueueConstruct**: SQS キューを管理（オプション）
- **ApiConstruct**: API Gateway と Lambda 関数を管理
- **WebsiteConstruct**: 静的ウェブサイト用の S3 バケットと CloudFront ディストリビューションを管理

メインスタックは、これらのコンストラクトを組み合わせて全体のインフラストラクチャを作成します。

## 前提条件

- [Node.js](https://nodejs.org/) (14.x 以上)
- [AWS CLI](https://aws.amazon.com/cli/) (設定済み)
- [AWS CDK](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html)

## 使い方

### プロジェクトのセットアップ

```bash
# 依存関係のインストール
npm install

# CDK ブートストラップ（初回のみ）
npx cdk bootstrap
```

### デプロイ

#### SQS なしでデプロイ

```bash
npx cdk deploy
```

#### SQS ありでデプロイ

```bash
npx cdk deploy --context use-sqs=true
```

### 削除

```bash
npx cdk destroy
```

## API エンドポイント

デプロイ後、以下の API エンドポイントが利用可能になります：

- `POST /api/files` - S3 バケットにファイルをアップロード

  ```json
  {
    "fileName": "example.txt",
    "content": "ファイルの内容",
    "contentType": "text/plain"
  }
  ```

- `GET /api/files/{fileName}` - S3 バケットからファイルを取得

- `POST /api/queue` - SQS キューにメッセージを送信（SQS が有効な場合のみ）
  ```json
  {
    "message": "キューに送信するメッセージ"
  }
  ```

## スタック出力

デプロイ後、以下の情報が出力されます：

- CloudFront のドメイン名（ウェブサイトのアクセス URL）
- API Gateway の URL
- S3 バケット名
- SQS キューの URL（SQS 有効時のみ）

## プロジェクト構造

```
.
├── bin/ - CDKアプリケーションのエントリーポイント
├── lib/ - CDKスタックとコンストラクト
│   ├── constructs/ - 再利用可能なコンストラクト
│   │   ├── api-construct.ts - API GatewayとLambda
│   │   ├── queue-construct.ts - SQSキュー
│   │   ├── storage-construct.ts - S3ストレージ
│   │   └── website-construct.ts - ウェブサイトとCloudFront
│   └── cdk_alb_lambda-stack.ts - メインスタック
├── lambda/ - Lambda関数コード
│   ├── api-handler.ts - APIハンドラー
│   └── utils.ts - ユーティリティ関数
└── website/ - 静的ウェブサイトファイル
    └── index.html - サンプルウェブページ
```

## カスタマイズ

- `lib/constructs/` - 各コンストラクトの定義
- `lib/cdk_alb_lambda-stack.ts` - メインスタックの定義
- `lambda/api-handler.ts` - Lambda 関数のコード
- `website/` - 静的ウェブサイトのファイル
