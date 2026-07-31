import { type RouteHandler } from '@hono/zod-openapi';

import type { unfollowRoute } from '../../routes/Follow/unfollowRoute.js';
import { FollowError } from '../../services/follow/iFollowService.js';
import type { AppEnv } from '../../di/container.js';

/**
 * アンフォロー機能のハンドラー
 *
 * APIリクエストを受け取り、サービスを呼び出して
 * レスポンスを返す
 */

/**
 * アンフォロー処理のハンドラー関数
 * POST /unfollow のリクエストを処理
 */
const unfollowHandler: RouteHandler<typeof unfollowRoute, AppEnv> = async (c) => {
  const { followService } = c.get('container');
  // リクエストボディからデータを取得
  const { followerId, followeeId } = await c.req.json();

  console.log(`[Handler] アンフォローリクエストを受け付けました: ${followerId} -> ${followeeId}`);

  // サービスを呼び出してアンフォロー処理を実行
  const result = await followService.unfollowUser(followerId, followeeId);

  if (result.success) {
    console.log(`[Handler] アンフォロー処理が正常に完了しました: ${followerId} -> ${followeeId}`);

    // 成功レスポンスを返す
    return c.json(
      {
        message: 'フォローを解除しました',
      },
      200
    );
  }

  // エラーレスポンスを返す
  console.error(
    `[Handler] アンフォロー処理でエラーが発生しました: ${result.error} - ${result.message}`
  );

  // エラータイプに応じて適切なステータスコードを返す
  switch (result.error) {
    case FollowError.NOT_FOLLOWING:
      return c.json(
        {
          message: result.message,
          statusCode: 409,
          error: 'Conflict',
        },
        409
      );
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

export default unfollowHandler;
