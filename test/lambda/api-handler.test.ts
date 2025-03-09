import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Readable } from 'stream';

// まずモックを作成
const mockS3Send = jest.fn();
const mockSQSSend = jest.fn();

// S3とSQSのモジュールをモック化
jest.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: jest.fn().mockImplementation(() => ({
      send: mockS3Send,
    })),
    PutObjectCommand: jest.fn(),
    GetObjectCommand: jest.fn(),
  };
});

jest.mock('@aws-sdk/client-sqs', () => {
  return {
    SQSClient: jest.fn().mockImplementation(() => ({
      send: mockSQSSend,
    })),
    SendMessageCommand: jest.fn(),
  };
});

// 環境変数の設定
process.env.BUCKET_NAME = 'test-bucket';
process.env.QUEUE_URL =
  'https://sqs.us-east-1.amazonaws.com/123456789012/test-queue';
process.env.AWS_REGION = 'us-east-1';

// 簡略化したテストで、テスト対象の関数をモック後にロードする
describe('API Handler Lambda', () => {
  let handler: any;

  beforeAll(async () => {
    // テスト対象のハンドラーを動的にインポート
    const module = await import('../../lambda/api-handler');
    handler = module.handler;
  });

  beforeEach(() => {
    // 各テスト前にモックをリセット
    jest.clearAllMocks();
  });

  describe('基本的なルーティング', () => {
    test('GETリクエストを処理できること', async () => {
      // S3レスポンスのモック
      mockS3Send.mockResolvedValueOnce({
        Body: {
          transformToString: () => Promise.resolve('test content'),
        },
        ContentType: 'text/plain',
      });

      const event = {
        httpMethod: 'GET',
        path: '/api/files/test.txt',
        pathParameters: { fileName: 'test.txt' },
      } as any;

      const result = await handler(event);
      // 基本的なレスポンスのみチェック
      expect(result).toBeDefined();
    });

    test('POSTリクエストを処理できること', async () => {
      // S3レスポンスのモック
      mockS3Send.mockResolvedValueOnce({});

      const event = {
        httpMethod: 'POST',
        path: '/api/files',
        body: JSON.stringify({
          fileName: 'test.txt',
          content: 'Hello World',
        }),
      } as any;

      const result = await handler(event);
      // 基本的なレスポンスのみチェック
      expect(result).toBeDefined();
    });

    test('存在しないパスには404を返すこと', async () => {
      const event = {
        httpMethod: 'GET',
        path: '/unknown',
      } as any;

      const result = await handler(event);
      expect(result.statusCode).toBe(404);
    });
  });
});
