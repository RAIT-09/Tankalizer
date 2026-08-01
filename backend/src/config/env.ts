import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.string(),
  FRONTEND_URL: z.string().url(),
  PORT: z.coerce.number().optional(),
  GEMINI_API_KEY: z.string(),
  NEWS_POST_API_KEY: z.string(),
  NEWS_USER_ID: z.string(),
  S3_ACCESS_KEY_ID: z.string(),
  S3_SECRET_ACCESS_KEY: z.string(),
  S3_BUCKET_NAME: z.string(),
  CDN_URL: z.string(),
  OUR_ID: z.string(),
  DEFAULT_ICON_PATH: z.string(),
});

export type AppConfig = z.infer<typeof envSchema>;

export const parseConfig = (env: Record<string, unknown>): AppConfig => envSchema.parse(env);
