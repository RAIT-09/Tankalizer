import type { Context, MiddlewareHandler } from 'hono';
import { verify } from 'hono/jwt';
import type { JWTPayload } from 'hono/utils/jwt/types';
import type { AppConfig } from '../config/env.js';
import type { AppEnv } from '../di/container.js';
import { UnauthorizedError } from '../utils/errors.js';

const BEARER_PREFIX = 'Bearer ';

const OAUTH_PROVIDERS = ['github', 'google'] as const;

export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

const isOAuthProvider = (value: unknown): value is OAuthProvider =>
  typeof value === 'string' && (OAUTH_PROVIDERS as readonly string[]).includes(value);

/** セッション確立前に呼ばれる POST /v2/user 専用。通常のユーザートークンと混用させないため aud を分ける。 */
export const provisioningAudience = (config: AppConfig): string =>
  `${config.JWT_AUDIENCE}-provisioning`;

/** RFC 7235 の認証スキームは大文字小文字を区別しない。 */
const extractBearerToken = (header: string): string | null => {
  if (!header.toLowerCase().startsWith(BEARER_PREFIX.toLowerCase())) return null;
  const token = header.slice(BEARER_PREFIX.length).trim();
  return token.length > 0 ? token : null;
};

/** ヘッダを付けてきた以上は認証の試行とみなし、壊れていれば匿名に落とさず弾く。 */
const requireBearerToken = (header: string): string => {
  const token = extractBearerToken(header);
  if (!token) {
    throw new UnauthorizedError('認証情報が不正です．');
  }
  return token;
};

const audienceMatches = (aud: JWTPayload['aud'], expected: string): boolean =>
  Array.isArray(aud) ? aud.includes(expected) : aud === expected;

/** hono の verify は exp/nbf しか検証しないため、iss/aud と exp の存在は自前で確かめる。 */
const verifyToken = async (
  token: string,
  config: AppConfig,
  expectedAudience: string
): Promise<JWTPayload> => {
  let payload: JWTPayload;
  try {
    payload = await verify(token, config.BACKEND_JWT_SECRET, 'HS256');
  } catch {
    throw new UnauthorizedError('トークンが不正です．');
  }

  // exp が無いトークンは無期限になるため拒否する
  if (typeof payload.exp !== 'number') {
    throw new UnauthorizedError('トークンが不正です．');
  }
  if (payload.iss !== config.JWT_ISSUER) {
    throw new UnauthorizedError('トークンが不正です．');
  }
  if (!audienceMatches(payload.aud, expectedAudience)) {
    throw new UnauthorizedError('トークンが不正です．');
  }

  return payload;
};

const requireSubject = (payload: JWTPayload): string => {
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new UnauthorizedError('トークンが不正です．');
  }
  return payload.sub;
};

/** requireAuth 済みルートで検証済みユーザーIDを取り出す。 */
export const getUserId = (c: Context<AppEnv>): string => {
  const userId = c.get('userId');
  if (!userId) {
    throw new UnauthorizedError('認証が必要です．');
  }
  return userId;
};

/** 更新系ルート用。検証済みのユーザーIDを userId に載せる。 */
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const header = c.req.header('Authorization');
  if (header === undefined) {
    throw new UnauthorizedError('認証が必要です．');
  }

  const config = c.get('config');
  const payload = await verifyToken(requireBearerToken(header), config, config.JWT_AUDIENCE);
  c.set('userId', requireSubject(payload));

  await next();
};

/** 閲覧系ルート用。未ログインでも通し、トークンがあれば viewer として扱う。 */
export const optionalAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const header = c.req.header('Authorization');
  if (header !== undefined) {
    const config = c.get('config');
    const payload = await verifyToken(requireBearerToken(header), config, config.JWT_AUDIENCE);
    c.set('userId', requireSubject(payload));
  }

  await next();
};

/** POST /v2/user 用。OAuth で確認済みの provider と アカウントID を載せる。 */
export const requireProvisioningAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const header = c.req.header('Authorization');
  if (header === undefined) {
    throw new UnauthorizedError('認証が必要です．');
  }

  const config = c.get('config');
  const payload = await verifyToken(
    requireBearerToken(header),
    config,
    provisioningAudience(config)
  );

  const provider = payload.provider;
  const providerAccountId = payload.provider_account_id;
  const email = payload.email;
  if (
    !isOAuthProvider(provider) ||
    typeof providerAccountId !== 'string' ||
    providerAccountId.length === 0 ||
    typeof email !== 'string' ||
    email.length === 0
  ) {
    throw new UnauthorizedError('トークンが不正です．');
  }

  c.set('provisioning', { provider, providerAccountId, email });

  await next();
};
