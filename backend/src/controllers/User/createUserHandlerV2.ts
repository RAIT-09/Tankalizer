import { type RouteHandler } from '@hono/zod-openapi';

import type { createUserRouteV2 } from '../../routes/User/createUserRouteV2.js';
import type { CreateUserDTO } from '../../services/user/iUserService.js';
import type { AppEnv } from '../../di/container.js';

const createUserHandlerV2: RouteHandler<typeof createUserRouteV2, AppEnv> = async (c) => {
  const { userService } = c.get('container');
  try {
    // リクエストからデータを取得
    const formData = await c.req.formData();
    const name = formData.get('name') as string;
    const oauth_app = formData.get('oauth_app') as 'github' | 'google';
    const connect_info = formData.get('connect_info') as string;
    const profile_text = formData.get('profile_text') as string;
    const icon_url = formData.get('icon_url') as string;

    const userDto: CreateUserDTO = { name, oauth_app, connect_info, profile_text, icon_url };

    console.log('[Handler] /v2/user へのリクエストを受け付けました．', userDto);

    // ユーザー作成処理
    const createUserResponse = await userService.createUser(userDto);

    // ユーザーが既に作成済みの場合
    if (createUserResponse.type === 'existing') {
      return c.json(
        {
          message: 'ユーザーは既に作成済みです．',
          user: createUserResponse.user,
          type: createUserResponse.type,
        },
        200
      );
    }

    // 旧DBからの乗り換えが完了した場合
    if (createUserResponse.type === 'migrated') {
      return c.json(
        {
          message: '旧DBからの乗り換えが完了しました．',
          user: createUserResponse.user,
          type: createUserResponse.type,
        },
        200
      );
    }

    // 新規ユーザーの作成が完了した場合
    if (createUserResponse.type === 'created') {
      return c.json(
        {
          message: '新規ユーザーの作成が完了しました．',
          user: createUserResponse.user,
          type: createUserResponse.type,
        },
        200
      );
    }

    // typeが不明な場合
    return c.json(
      {
        message: '不明なエラーが発生しました．',
        statusCode: 500,
        error: 'Internal Server Error',
      },
      500
    );
  } catch (err: any) {
    // エラーハンドリング
    console.error('[Handler] ユーザー作成処理中にエラーが発生しました．', err);
    return c.json(
      {
        message: err.message,
        statusCode: 500,
        error: 'Internal Server Error',
      },
      500
    );
  }
};

export default createUserHandlerV2;
