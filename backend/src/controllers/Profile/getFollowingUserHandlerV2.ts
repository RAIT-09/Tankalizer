import { z, type RouteHandler } from '@hono/zod-openapi';
import { NotFoundError } from '../../services/profile/iProfileService.js';
import type { getFollowingUserRouteV2 } from '../../routes/Profile/getFollowingUserRouteV2.js';
import { getFollowingUserSchema } from '../../schema/Profile/getFollowingUserSchemaV2.js';
import type { AppEnv } from '../../di/container.js';
import { internalErrorMessage } from '../../middleware/errorHandler.js';

type getFollowingUserSchema = z.infer<typeof getFollowingUserSchema>;

const getFollowingUserHandlerV2: RouteHandler<typeof getFollowingUserRouteV2, AppEnv> = async (c) => {
  const { profileService } = c.get('container');

  try {
    // リクエストからデータを取得
    const { user_id, limit, cursor } = c.req.valid('json');
    const viewer_id = c.get('userId');

    const profiles = await profileService.getFollowingUser({ user_id, viewer_id, limit, cursor });

    return c.json(
      {
        message: 'フォローしているユーザーを取得しました．',
        users: profiles,
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

export default getFollowingUserHandlerV2;
