import { z, type RouteHandler } from '@hono/zod-openapi';
import {
  NotFoundError,
  type UpdateProfileDTO,
} from '../../services/profile/iProfileService.js';
import type { updateProfileRouteV2 } from '../../routes/Profile/updateProfileRouteV2.js';
import { updateProfileSchema } from '../../schema/Profile/updateProfileSchemaV2.js';
import type { AppEnv } from '../../di/container.js';

type updateProfileSchema = z.infer<typeof updateProfileSchema>;

const updateProfileHandlerV2: RouteHandler<typeof updateProfileRouteV2, AppEnv> = async (c) => {
  const { profileService } = c.get('container');

  try {
    // リクエストからデータを取得
    const formData = await c.req.formData();
    const user_id = formData.get('user_id') as string;
    const user_name = formData.get('user_name') as string;
    const profile_text = formData.get('profile_text') as string;
    const icon_image = (formData.get('icon_image') as File) || null; // 画像がない場合はnull

    // DTOにデータを詰める
    const updateProfileDto: UpdateProfileDTO = {
      user_id,
      user_name,
      profile_text,
      icon_image,
    };

    const profile = await profileService.updateProfile(updateProfileDto);

    return c.json(
      {
        message: 'プロフィールを更新しました．',
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

export default updateProfileHandlerV2;
