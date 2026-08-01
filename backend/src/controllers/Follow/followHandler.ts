import { type RouteHandler } from '@hono/zod-openapi';

import type { followRoute } from '../../routes/Follow/followRoute.js';
import { FollowError } from '../../services/follow/iFollowService.js';
import type { AppEnv } from '../../di/container.js';

/**
 * フォロー機能のハンドラー
 *
 * APIリクエストを受け取り、サービスを呼び出して
 * レスポンスを返す
 */

/**
 * フォロー処理のハンドラー関数
 * POST /follow のリクエストを処理
 */
const followHandler: RouteHandler<typeof followRoute, AppEnv> = async (c) => {
  const { followService } = c.get('container');
  // リクエストボディからデータを取得
  const { followerId, followeeId } = await c.req.json();

  console.log(`[Handler] フォローリクエストを受け付けました: ${followerId} -> ${followeeId}`);

  // サービスを呼び出してフォロー処理を実行
  const result = await followService.followUser(followerId, followeeId);

  if (result.success) {
    console.log(`[Handler] フォロー処理が正常に完了しました: ${followerId} -> ${followeeId}`);

    // 成功レスポンスを返す
    return c.json(
      {
        message: 'フォローしました',
      },
      200
    );
  }

  // エラーレスポンスを返す
  console.error(
    `[Handler] フォロー処理でエラーが発生しました: ${result.error} - ${result.message}`
  );

  // エラータイプに応じて適切なステータスコードを返す
  switch (result.error) {
    case FollowError.SELF_FOLLOW:
      return c.json(
        {
          message: result.message,
          statusCode: 400,
          error: 'Bad Request',
        },
        400
      );
    case FollowError.ALREADY_FOLLOWING:
      return c.json(
        {
          message: result.message,
          statusCode: 409,
          error: 'Conflict',
        },
        409
      );
    case FollowError.USER_NOT_FOUND:
      return c.json(
        {
          message: result.message,
          statusCode: 404,
          error: 'Not Found',
        },
        404
      );
    case FollowError.DATABASE_ERROR:
    default:
      return c.json(
        {
          message: result.message,
          statusCode: 500,
          error: 'Internal Server Error',
        },
        500
      );
  }
};

export default followHandler;
