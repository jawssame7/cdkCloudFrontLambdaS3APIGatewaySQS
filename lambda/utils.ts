import { Readable } from 'stream';

/**
 * ストリームを文字列に変換するユーティリティ関数
 * @param stream 変換対象のストリーム
 * @returns 文字列に変換された結果
 */
export async function streamToString(stream: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * レスポンスを生成するユーティリティ関数
 * @param statusCode HTTPステータスコード
 * @param body レスポンスボディ
 * @param headers 追加するHTTPヘッダー
 * @returns API Gateway用のレスポンスオブジェクト
 */
export function createResponse(
  statusCode: number,
  body: any,
  headers: Record<string, string> = {}
) {
  return {
    statusCode,
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };
}
