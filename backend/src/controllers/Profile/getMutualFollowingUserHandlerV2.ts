import { z, type RouteHandler } from '@hono/zod-openapi';
import { NotFoundError } from '../../services/profile/iProfileService.js';
import type { getMutualFollowingUserRouteV2 } from '../../routes/Profile/getMutualFollowingUserRouteV2.js';
import { getMutualFollowingUserSchema } from '../../schema/Profile/getMutualFollowingUserSchemaV2.js';
import type { AppEnv } from '../../di/container.js';
import { internalErrorMessage } from '../../middleware/errorHandler.js';

type getMutualFollowingUserSchema = z.infer<typeof getMutualFollowingUserSchema>;

const getMutualFollowingUserHandlerV2: RouteHandler<
  typeof getMutualFollowingUserRouteV2,
  AppEnv
> = async (c) => {
  const { profileService } = c.get('container');

  try {
    // リクエストからデータを取得
    const { user_id, limit, cursor } = c.req.valid('json');
    const viewer_id = c.get('userId');

    const profiles = await profileService.getMutualFollowingUser({
      user_id,
      viewer_id,
      limit,
      cursor,
    });

    return c.json(
      {
        message: '相互フォローしているユーザーを取得しました．',
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

export default getMutualFollowingUserHandlerV2;
