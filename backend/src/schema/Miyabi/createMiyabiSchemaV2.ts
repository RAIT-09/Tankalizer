import { z } from '@hono/zod-openapi';

// リクエストの型
export const createMiyabiSchema = z.object({
  post_id: z.string().openapi({
    example: '8e21e23a-eb9f-11ef-9ce7-0242ac130002',
    description: '投稿ID (36文字のUUID形式)',
  }),
});

// レスポンスの型
export const createMiyabiResponseSchema = z.object({
  message: z.string(),
});
