import { z } from '@hono/zod-openapi';

// リクエストの型
export const deleteMiyabiSchema = z.object({
  post_id: z.string().openapi({
    example: '8e21e23a-eb9f-11ef-9ce7-0242ac130002',
    description: '投稿id',
  }),
});

// レスポンスの型
export const deleteMiyabiResponseSchema = z.object({
  message: z.string(),
});
