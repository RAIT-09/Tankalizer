import { z } from '@hono/zod-openapi';

// リクエストの型
export const createPostSchema = z.object({
  original: z.string().openapi({
    example: 'これは投稿の原文です．技育博に向けてブラッシュアップを頑張りましょう．',
    description: '原文',
  }),
  image: z
    .custom((val) => val === null || val instanceof Blob || val == '')
    .optional()
    .openapi({
      type: 'string',
      format: 'binary',
      description: '添付画像ファイル',
    }),
});

// レスポンスの型
export const createPostResponseSchema = z.object({
  message: z.string(),
  tanka: z.array(z.string()),
});
