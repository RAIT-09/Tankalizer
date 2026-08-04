import { z, type RouteHandler } from '@hono/zod-openapi';
import { NotFoundError, ConflictError } from '../../services/miyabi/iMiyabiService.js';
import type { createMiyabiSchema } from '../../schema/Miyabi/createMiyabiSchemaV2.js';
import type { createMiyabiRouteV2 } from '../../routes/Miyabi/createMiyabiRouteV2.js';
import type { AppEnv } from '../../di/container.js';
import { getUserId } from '../../middleware/auth.js';
import { internalErrorMessage } from '../../middleware/errorHandler.js';

type createMiyabiSchema = z.infer<typeof createMiyabiSchema>;

const createMiyabiHandlerV2: RouteHandler<typeof createMiyabiRouteV2, AppEnv> = async (c) => {
  const { miyabiService } = c.get('container');

  try {
    // リクエストからデータを取得
    const { post_id } = c.req.valid('json');
    const user_id = getUserId(c);

    // サービスを呼び出す
    const result = await miyabiService.createMiyabi({ user_id, post_id });

    // 成功レスポンスを返す
    return c.json(result, 200);
  } catch (err: any) {
    console.log(err.message);
    // エラーレスポンスを返す
    if (err instanceof NotFoundError) {
      return c.json({ message: err.message, statusCode: 404, error: 'Not Found' }, 404);
    }
    if (err instanceof ConflictError) {
      return c.json({ message: err.message, statusCode: 409, error: 'Conflict' }, 409);
    }
    console.error('[createMiyabiHandlerV2] エラーが発生しました．', err);
    return c.json(
      {
        message: internalErrorMessage(err, c.get('config').NODE_ENV),
        statusCode: 500,
        error: 'Internal Server Error',
      },
      500
    );
  }
};

export default createMiyabiHandlerV2;
