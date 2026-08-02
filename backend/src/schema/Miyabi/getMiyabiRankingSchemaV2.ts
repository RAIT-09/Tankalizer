import { z } from '@hono/zod-openapi';

// リクエストの型
export const getMiyabiRankingSchema = z.object({
  limit: z.number().int().min(1).max(100).default(10).openapi({
    example: 10,
    description: '取得する投稿の数',
  }),
});

export const RankedPost = z.object({
  rank: z.number().int().min(1),
  id: z.string(),
  original: z.string(),
  tanka: z.array(z.string()),
  image_path: z.string().nullable(),
  created_at: z.string(),
  is_developer: z.boolean(),
  user_id: z.string(),
  user_name: z.string(),
  user_icon: z.string(),
  miyabi_count: z.number().int().min(0),
  is_miyabi: z.boolean(),
});

// レスポンスの型
export const getMiyabiRankingResponseSchema = z.object({
  message: z.string(),
  ranked_posts: z.array(RankedPost),
});
