import { z, type RouteHandler } from '@hono/zod-openapi';
import { newsTankaSchema } from '../../schema/News/newsTankaSchema.js';
import type { newsTankaRoute } from '../../routes/News/newsTankaRoute.js';
import postNews from '../../lib/postNews.js';
import type { AppEnv } from '../../di/container.js';

type newsTankaSchema = z.infer<typeof newsTankaSchema>;

const newsTankaHandler: RouteHandler<typeof newsTankaRoute, AppEnv> = async (c) => {
  const container = c.get('container');
  const config = c.get('config');
  const { apiKey } = await c.req.json<newsTankaSchema>();

  /* --- 色々処理 --- */

  const response = await postNews(apiKey, container, config);
  console.log(response);

  if (!response.isAuthorized) {
    return c.json({ message: 'APIキーが間違っています', statusCode: 403, error: 'Forbidden' }, 403);
  }

  if (!response.isSuccess) {
    return c.json(
      { message: '短歌の生成に失敗しました', statusCode: 500, error: 'Internal Server Error' },
      500
    );
  }

  // レスポンス
  return c.json(response, 200);
};

export default newsTankaHandler;
