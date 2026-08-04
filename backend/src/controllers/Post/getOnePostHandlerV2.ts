import { z, type RouteHandler } from '@hono/zod-openapi';
import type { getOnePostRouteV2 } from '../../routes/Post/getOnePostRouteV2.js';
import { getOnePostSchema } from '../../schema/Post/getOnePostSchemaV2.js';
import type { AppEnv } from '../../di/container.js';
import { internalErrorMessage } from '../../middleware/errorHandler.js';

type getOnePostSchema = z.infer<typeof getOnePostSchema>;

const getOnePostHandlerV2: RouteHandler<typeof getOnePostRouteV2, AppEnv> = async (c) => {
  const { postService } = c.get('container');

  try {
    // リクエストからデータを取得
    const { id } = c.req.valid('json');
    const viewerId = c.get('userId');

    const post = await postService.getOnePost({ id, viewerId });

    if (!post) {
      return c.json(
        {
          message: '指定された投稿は存在しません．',
          statusCode: 404,
          error: 'Not Found',
        },
        404
      );
    }
    return c.json(
      {
        message: '投稿を取得しました．',
        post: post,
      },
      200
    );
  } catch (err: any) {
    return c.json({ message: internalErrorMessage(err, c.get('config').NODE_ENV), statusCode: 500, error: 'Internal Server Error' }, 500);
  }
};

export default getOnePostHandlerV2;
