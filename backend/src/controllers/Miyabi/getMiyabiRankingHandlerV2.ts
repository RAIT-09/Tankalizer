import { z, type RouteHandler } from '@hono/zod-openapi';
import type { getMiyabiRankingRouteV2 } from '../../routes/Miyabi/getMiyabiRankingRouteV2.js';
import { getMiyabiRankingSchema } from '../../schema/Miyabi/getMiyabiRankingSchemaV2.js';
import type { AppEnv } from '../../di/container.js';

type getMiyabiRankingSchema = z.infer<typeof getMiyabiRankingSchema>;

const getMiyabiRankingHandlerV2: RouteHandler<typeof getMiyabiRankingRouteV2, AppEnv> = async (c) => {
  const { miyabiService } = c.get('container');

  try {
    // リクエストからデータを取得
    const { limit, viewerId } = await c.req.json<getMiyabiRankingSchema>();

    const ranked_posts = await miyabiService.getMiyabiRanking({ limit, viewerId });

    return c.json(
      {
        message: '雅ランキングを取得しました．',
        ranked_posts: ranked_posts,
      },
      200
    );
  } catch (err: any) {
    return c.json({ message: err.message, statusCode: 500, error: 'Internal Server Error' }, 500);
  }
};

export default getMiyabiRankingHandlerV2;
