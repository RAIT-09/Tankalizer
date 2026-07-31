import { z, type RouteHandler } from '@hono/zod-openapi';
import { NotFoundError } from '../../services/profile/iProfileService.js';
import type { getProfileRouteV2 } from '../../routes/Profile/getProfileRouteV2.js';
import { getProfileSchema } from '../../schema/Profile/getProfileSchemaV2.js';
import type { AppEnv } from '../../di/container.js';

type getProfileSchema = z.infer<typeof getProfileSchema>;

const getProfileHandlerV2: RouteHandler<typeof getProfileRouteV2, AppEnv> = async (c) => {
  const { profileService } = c.get('container');

  try {
    // リクエストからデータを取得
    const { user_id, viewer_id } = await c.req.json<getProfileSchema>();

    const profile = await profileService.getProfile({ user_id, viewer_id });

    return c.json(
      {
        message: 'プロフィールを取得しました．',
        profile: profile,
      },
      200
    );
  } catch (err: any) {
    if (err instanceof NotFoundError) {
      return c.json({ message: err.message, statusCode: 404, error: 'Not Found' }, 404);
    }
    return c.json({ message: err.message, statusCode: 500, error: 'Internal Server Error' }, 500);
  }
};

export default getProfileHandlerV2;
