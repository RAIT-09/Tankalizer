import { type RouteHandler } from '@hono/zod-openapi';
import type { createPostRouteV2 } from '../../routes/Post/createPostRouteV2.js';
import type { CreatePostDTO } from '../../services/post/iPostService.js';
import type { AppEnv } from '../../di/container.js';

const createPostHandlerV2: RouteHandler<typeof createPostRouteV2, AppEnv> = async (c) => {
  const { postService } = c.get('container');

  try {
    // リクエストからデータを取得
    const formData = await c.req.formData();
    const original = formData.get('original') as string;
    const image = (formData.get('image') as File) || null; // 画像がない場合はnull
    const user_id = formData.get('user_id') as string;

    // バリデーション
    if (!original || !user_id) {
      return c.json(
        { message: 'originalとuser_idは必須です．', statusCode: 400, error: 'Bad Request' },
        400
      );
    }

    // DTOにデータを詰める
    const postDto: CreatePostDTO = {
      original,
      image,
      user_id,
    };

    // サービスを呼び出す
    const result = await postService.createPost(postDto);

    // 成功レスポンスを返す
    return c.json(result, 200);
  } catch (err: any) {
    // エラーレスポンスを返す
    console.error('[createPostHandlerV2] エラーが発生しました．', err);
    return c.json(
      {
        message: err.message || '投稿処理中に不明なエラーが発生しました．',
        statusCode: 500,
        error: 'Internal Server Error',
      },
      500
    );
  }
};

export default createPostHandlerV2;
