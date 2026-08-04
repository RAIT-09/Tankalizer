import { z } from 'zod';

// フォロー関連のスキーマ定義
// リクエスト、レスポンスの形式を定義

// フォロー・フォロー解除APIのリクエスト形式
export const followRequestSchema = z.object({
  followeeId: z.string().openapi({
    example: '469b4df1-0306-4dfb-8a1e-4625d1d6e293',
    description: 'フォローされるユーザーID (36文字のUUID形式)',
  }),
});

// フォロー・フォロー解除APIのレスポンス形式
export const followResponseSchema = z.object({
  message: z.string(), // 処理結果のメッセージ
});

// TypeScript型定義（Zodスキーマから自動生成）
export type FollowRequest = z.infer<typeof followRequestSchema>;
export type FollowResponse = z.infer<typeof followResponseSchema>;
