import { getCloudflareContext } from '@opennextjs/cloudflare';
import { sign } from 'hono/jwt';

// バックエンドへの到達は Service Binding 内に閉じているので、リプレイ余地を潰す短さで足りる
const TOKEN_TTL_SECONDS = 120;

const getJwtEnv = () => {
  const { env } = getCloudflareContext();
  const vars = env as unknown as Record<string, string | undefined>;
  const secret = vars.BACKEND_JWT_SECRET;

  if (!secret) {
    throw new Error('BACKEND_JWT_SECRET が設定されていません．');
  }

  return {
    secret,
    issuer: vars.JWT_ISSUER ?? 'tankalizer-web',
    audience: vars.JWT_AUDIENCE ?? 'tankalizer-api',
  };
};

/** ログイン済みユーザーとしてバックエンドを呼ぶためのトークン。 */
export const signUserToken = async (userId: string): Promise<string> => {
  const { secret, issuer, audience } = getJwtEnv();
  const now = Math.floor(Date.now() / 1000);

  return sign(
    { sub: userId, iss: issuer, aud: audience, iat: now, exp: now + TOKEN_TTL_SECONDS },
    secret,
    'HS256'
  );
};

/**
 * ユーザー作成用トークン。
 */
export const signProvisioningToken = async (
  provider: string,
  providerAccountId: string,
  email: string
): Promise<string> => {
  const { secret, issuer, audience } = getJwtEnv();
  const now = Math.floor(Date.now() / 1000);

  return sign(
    {
      sub: `${provider}:${providerAccountId}`,
      provider,
      provider_account_id: providerAccountId,
      email,
      iss: issuer,
      aud: `${audience}-provisioning`,
      iat: now,
      exp: now + TOKEN_TTL_SECONDS,
    },
    secret,
    'HS256'
  );
};
