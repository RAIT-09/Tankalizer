import { z, type RouteHandler } from '@hono/zod-openapi';
import { NotFoundError } from '../../services/post/iPostService.js';
import type { getFollowingPostRouteV2 } from '../../routes/Post/getFollowingPostRouteV2.js';
import { getFollowingPostSchema } from '../../schema/Post/getFollowingPostSchemaV2.js';
import type { AppEnv } from '../../di/container.js';
import { getUserId } from '../../middleware/auth.js';
import { internalErrorMessage } from '../../middleware/errorHandler.js';

type getFollowingPostSchema = z.infer<typeof getFollowingPostSchema>;

const getFollowingPostHandlerV2: RouteHandler<typeof getFollowingPostRouteV2, AppEnv> = async (c) => {
  const { postService } = c.get('container');

  try {
    // リクエストからデータを取得
    const { limit, cursor } = c.req.valid('json');
    const viewerId = getUserId(c);

    const posts = await postService.getFollowingPost({ limit, cursor, viewerId });

    return c.json(
      {
        message: '投稿を取得しました．',
        posts: posts,
      },
      200
    );
  } catch (err: any) {
    if (err instanceof NotFoundError) {
      return c.json({ message: err.message, statusCode: 404, error: 'Not Found' }, 404);
    }
    return c.json({ message: internalErrorMessage(err, c.get('config').NODE_ENV), statusCode: 500, error: 'Internal Server Error' }, 500);
  }
};

export default getFollowingPostHandlerV2;
