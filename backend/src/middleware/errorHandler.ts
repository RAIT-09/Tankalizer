import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { z } from '@hono/zod-openapi';
import { AppError, type ErrorResponse } from '../utils/errors.js';

export const errorResponseSchema = z.object({
  message: z.string(),
  statusCode: z.number(),
  error: z.string(),
});

/** 未知の例外にはSQL文や外部APIの詳細が乗るため、本番では固定文言に潰す。 */
export const internalErrorMessage = (err: unknown, nodeEnv: string | undefined): string =>
  nodeEnv === 'production'
    ? 'Internal Server Error'
    : `Internal Server Error: ${err instanceof Error ? err.message : String(err)}`;

export const errorHandler = (err: Error, c: Context) => {
  if (err instanceof AppError) {
    const appErrorResponse: ErrorResponse = {
      message: err.message,
      statusCode: err.statusCode,
      error: err.constructor.name,
    };
    return c.json(appErrorResponse, appErrorResponse.statusCode as ContentfulStatusCode);
  }

  console.error('[errorHandler] 未処理の例外が発生しました．', err);

  const errorResponse: ErrorResponse = {
    message: internalErrorMessage(err, c.get('config')?.NODE_ENV),
    statusCode: 500,
    error: 'InternalServerError',
  };

  return c.json(errorResponse, 500);
};
