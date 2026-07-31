import { z, type RouteHandler } from '@hono/zod-openapi';
import { NotFoundError, ConflictError } from '../../services/miyabi/iMiyabiService.js';
import type { deleteMiyabiSchema } from '../../schema/Miyabi/deleteMiyabiSchemaV2.js';
import type { deleteMiyabiRouteV2 } from '../../routes/Miyabi/deleteMiyabiRouteV2.js';
import type { AppEnv } from '../../di/container.js';

type deleteMiyabiSchema = z.infer<typeof deleteMiyabiSchema>;

const deleteMiyabiHandlerV2: RouteHandler<typeof deleteMiyabiRouteV2, AppEnv> = async (c) => {
  const { miyabiService } = c.get('container');

  try {
    // リクエストからデータを取得
    const { user_id, post_id } = await c.req.json<deleteMiyabiSchema>();

    // サービスを呼び出す
    const result = await miyabiService.deleteMiyabi({ user_id, post_id });

    // 成功レスポンスを返す
    return c.json(result, 200);
  } catch (err: any) {
    // エラーレスポンスを返す
    if (err instanceof NotFoundError) {
      return c.json({ message: err.message, statusCode: 404, error: 'Not Found' }, 404);
    }
    if (err instanceof ConflictError) {
      return c.json({ message: err.message, statusCode: 409, error: 'Conflict' }, 409);
    }
    console.error('[deleteMiyabiHandlerV2] エラーが発生しました．', err);
    return c.json(
      {
        message: err.message || '雅削除処理中に不明なエラーが発生しました．',
        statusCode: 500,
        error: 'Internal Server Error',
      },
      500
    );
  }
};

export default deleteMiyabiHandlerV2;
