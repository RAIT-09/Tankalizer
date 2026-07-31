import { z, type RouteHandler } from '@hono/zod-openapi';
import type { deletePostRouteV2 } from '../../routes/Post/deletePostRouteV2.js';
import { deletePostSchema } from '../../schema/Post/deletePostSchemaV2.js';
import type { AppEnv } from '../../di/container.js';

type deletePostSchema = z.infer<typeof deletePostSchema>;

const deletePostHandlerV2: RouteHandler<typeof deletePostRouteV2, AppEnv> = async (c) => {
  const { postService } = c.get('container');

  try {
    // リクエストからデータを取得
    const { post_id, user_id } = await c.req.json<deletePostSchema>();

    // サービスを呼び出す
    const result = await postService.deletePost({ post_id, user_id });

    // 成功レスポンスを返す
    return c.json(result, 200);
  } catch (err: any) {
    // エラーレスポンスを返す
    if (err.message === '投稿が見つかりません．') {
      return c.json({ message: err.message, statusCode: 404, error: 'Not Found' }, 404);
    }
    if (err.message === '許可がありません．') {
      return c.json({ message: err.message, statusCode: 403, error: 'Forbidden' }, 403);
    }
    console.error('[deletePostHandlerV2] エラーが発生しました．', err);
    return c.json(
      {
        message: err.message || '投稿削除処理中に不明なエラーが発生しました．',
        statusCode: 500,
        error: 'Internal Server Error',
      },
      500
    );
  }
};

export default deletePostHandlerV2;
