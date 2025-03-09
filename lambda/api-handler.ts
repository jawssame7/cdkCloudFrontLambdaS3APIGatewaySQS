import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { Readable } from 'stream';
import { streamToString, createResponse } from './utils';

// 環境変数から設定を取得
const BUCKET_NAME = process.env.BUCKET_NAME || '';
const QUEUE_URL = process.env.QUEUE_URL || '';

// AWSクライアントの初期化（リージョンを明示的に指定）
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const s3Client = new S3Client({ region: AWS_REGION });
const sqsClient = new SQSClient({ region: AWS_REGION });

/**
 * API Gateway Lambda ハンドラー
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    const path = event.path;
    const method = event.httpMethod;

    // URLパスに基づいて異なる処理を実行
    if (path.startsWith('/api/files')) {
      if (method === 'GET') {
        return await getFile(event);
      } else if (method === 'POST') {
        return await uploadFile(event);
      }
    } else if (path.startsWith('/api/queue') && method === 'POST') {
      return await sendToQueue(event);
    }

    // ルート以外のリクエスト
    return createResponse(404, { message: '404 Not Found' });
  } catch (error) {
    console.error('Error:', error);
    return createResponse(500, {
      message: 'Internal Server Error',
      error: String(error),
    });
  }
};

/**
 * S3からファイルを取得
 */
async function getFile(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  // URLパスからファイル名を取得
  const pathParts = event.path.split('/');
  const fileName = pathParts[pathParts.length - 1];

  if (!fileName) {
    return createResponse(400, { message: 'ファイル名を指定してください' });
  }

  try {
    // S3からファイルを取得
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileName,
      })
    );

    // レスポンスボディをJSON形式に変換
    const body = response.Body as Readable;
    if (!body) {
      throw new Error('ファイルの内容が空です');
    }

    const fileContent = await streamToString(body);

    return {
      statusCode: 200,
      body: fileContent,
      headers: {
        'Content-Type': response.ContentType || 'application/octet-stream',
      },
    };
  } catch (error) {
    console.error('Error getting file:', error);
    return createResponse(404, {
      message: 'ファイルが見つかりません',
      error: String(error),
    });
  }
}

/**
 * S3にファイルをアップロード
 */
async function uploadFile(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    return createResponse(400, { message: 'リクエストボディが空です' });
  }

  try {
    const requestBody = JSON.parse(event.body);
    const { fileName, content, contentType = 'application/json' } = requestBody;

    if (!fileName || !content) {
      return createResponse(400, {
        message: 'fileName と content フィールドが必要です',
      });
    }

    // S3にファイルをアップロード
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileName,
        Body: content,
        ContentType: contentType,
      })
    );

    return createResponse(200, {
      message: 'ファイルがアップロードされました',
      fileName,
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return createResponse(500, {
      message: 'ファイルのアップロードに失敗しました',
      error: String(error),
    });
  }
}

/**
 * SQSにメッセージを送信
 */
async function sendToQueue(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (!QUEUE_URL) {
    return createResponse(501, { message: 'SQS機能は有効になっていません' });
  }

  if (!event.body) {
    return createResponse(400, { message: 'リクエストボディが空です' });
  }

  try {
    const requestBody = JSON.parse(event.body);
    const { message } = requestBody;

    if (!message) {
      return createResponse(400, { message: 'message フィールドが必要です' });
    }

    // SQSにメッセージを送信
    await sqsClient.send(
      new SendMessageCommand({
        QueueUrl: QUEUE_URL,
        MessageBody: JSON.stringify(message),
      })
    );

    return createResponse(200, {
      message: 'メッセージがキューに送信されました',
    });
  } catch (error) {
    console.error('Error sending message to queue:', error);
    return createResponse(500, {
      message: 'メッセージの送信に失敗しました',
      error: String(error),
    });
  }
}
