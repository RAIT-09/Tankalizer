import { z, type RouteHandler } from '@hono/zod-openapi';
import type { getPostRouteV2 } from '../../routes/Post/getPostRouteV2.js';
import { getPostSchema } from '../../schema/Post/getPostSchemaV2.js';
import type { AppEnv } from '../../di/container.js';

type getPostSchema = z.infer<typeof getPostSchema>;

const getPostHandlerV2: RouteHandler<typeof getPostRouteV2, AppEnv> = async (c) => {
  const { postService } = c.get('container');

  try {
    // リクエストからデータを取得
    const { limit, cursor, filterByUserId, viewerId } = await c.req.json<getPostSchema>();

    const posts = await postService.getPost({ limit, cursor, filterByUserId, viewerId });

    return c.json(
      {
        message: '投稿を取得しました．',
        posts: posts,
      },
      200
    );
  } catch (err: any) {
    return c.json({ message: err.message, statusCode: 500, error: 'Internal Server Error' }, 500);
  }
};

export default getPostHandlerV2;
