import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import type { MiddlewareHandler } from 'hono';
import { describe, expect, it } from 'vitest';
import type { AppConfig } from '../config/env.js';
import type { AppEnv } from '../di/container.js';
import { optionalAuth, requireAuth, requireProvisioningAuth } from './auth.js';
import { errorHandler } from './errorHandler.js';

const SECRET = 'test-secret-that-is-long-enough-32';

const config = {
  NODE_ENV: 'test',
  BACKEND_JWT_SECRET: SECRET,
  JWT_ISSUER: 'tankalizer-web',
  JWT_AUDIENCE: 'tankalizer-api',
} as AppConfig;

const createApp = (middleware: MiddlewareHandler<AppEnv>) => {
  const app = new Hono<AppEnv>();
  app.use('*', async (c, next) => {
    c.set('config', config);
    await next();
  });
  app.use('*', middleware);
  app.get('/', (c) =>
    c.json({ userId: c.get('userId') ?? null, provisioning: c.get('provisioning') ?? null })
  );
  app.onError(errorHandler);
  return app;
};

const now = () => Math.floor(Date.now() / 1000);

const userClaims = () => ({
  sub: 'user-1',
  iss: 'tankalizer-web',
  aud: 'tankalizer-api',
  iat: now(),
  exp: now() + 120,
});

const provisioningClaims = () => ({
  ...userClaims(),
  aud: 'tankalizer-api-provisioning',
  provider: 'github',
  provider_account_id: '12345',
  email: 'user@example.com',
});

const call = (app: Hono<AppEnv>, authorization?: string) =>
  app.request('/', authorization ? { headers: { Authorization: authorization } } : {});

const base64url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

describe('requireAuth', () => {
  it('正しいトークンなら検証済みユーザーIDを載せる', async () => {
    const token = await sign(userClaims(), SECRET, 'HS256');
    const res = await call(createApp(requireAuth), `Bearer ${token}`);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ userId: 'user-1' });
  });

  it('aud が配列でも期待する値を含めば通す', async () => {
    const token = await sign(
      { ...userClaims(), aud: ['tankalizer-api', 'other'] },
      SECRET,
      'HS256'
    );
    const res = await call(createApp(requireAuth), `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it.each([
    ['Authorization ヘッダなし', undefined],
    ['トークンが空', 'Bearer '],
    ['Bearer 以外のスキーム', 'Basic dXNlcjpwYXNz'],
  ])('%s なら401', async (_label, header) => {
    const res = await call(createApp(requireAuth), header);
    expect(res.status).toBe(401);
  });

  it('スキーム名の大文字小文字は問わない', async () => {
    const token = await sign(userClaims(), SECRET, 'HS256');
    const res = await call(createApp(requireAuth), `bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('Bearer とトークンの間に区切りが無ければ401', async () => {
    const token = await sign(userClaims(), SECRET, 'HS256');
    const res = await call(createApp(requireAuth), `Bearer${token}`);

    expect(res.status).toBe(401);
  });

  it.each([
    ['期限切れ', async () => sign({ ...userClaims(), exp: now() - 10 }, SECRET, 'HS256')],
    [
      'exp が無い',
      async () =>
        sign(
          { sub: 'user-1', iss: 'tankalizer-web', aud: 'tankalizer-api', iat: now() },
          SECRET,
          'HS256'
        ),
    ],
    ['aud 不一致', async () => sign({ ...userClaims(), aud: 'other-api' }, SECRET, 'HS256')],
    ['iss 不一致', async () => sign({ ...userClaims(), iss: 'evil' }, SECRET, 'HS256')],
    ['sub が無い', async () => sign({ ...userClaims(), sub: undefined }, SECRET, 'HS256')],
    ['別の秘密鍵で署名', async () => sign(userClaims(), 'x'.repeat(40), 'HS256')],
    [
      'provisioning 用トークンの流用',
      async () => sign(provisioningClaims(), SECRET, 'HS256'),
    ],
  ])('%s なら401', async (_label, makeToken) => {
    const res = await call(createApp(requireAuth), `Bearer ${await makeToken()}`);
    expect(res.status).toBe(401);
  });

  it('alg: none は受け付けない', async () => {
    const token = `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url(userClaims())}.`;
    const res = await call(createApp(requireAuth), `Bearer ${token}`);

    expect(res.status).toBe(401);
  });
});

describe('optionalAuth', () => {
  it('Authorization ヘッダが無ければ匿名として通す', async () => {
    const res = await call(createApp(optionalAuth));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ userId: null });
  });

  it('正しいトークンなら viewer として扱う', async () => {
    const token = await sign(userClaims(), SECRET, 'HS256');
    const res = await call(createApp(optionalAuth), `Bearer ${token}`);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ userId: 'user-1' });
  });

  it('壊れたトークンは匿名に落とさず401にする', async () => {
    const token = await sign({ ...userClaims(), exp: now() - 10 }, SECRET, 'HS256');
    const res = await call(createApp(optionalAuth), `Bearer ${token}`);

    expect(res.status).toBe(401);
  });

  it.each([
    ['Bearer 以外のスキーム', 'Basic dXNlcjpwYXNz'],
    ['トークンが空', 'Bearer '],
  ])('%s は匿名に落とさず401にする', async (_label, header) => {
    const res = await call(createApp(optionalAuth), header);

    expect(res.status).toBe(401);
  });
});

describe('requireProvisioningAuth', () => {
  it('provider とアカウントIDとメールを載せる', async () => {
    const token = await sign(provisioningClaims(), SECRET, 'HS256');
    const res = await call(createApp(requireProvisioningAuth), `Bearer ${token}`);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      provisioning: { provider: 'github', providerAccountId: '12345', email: 'user@example.com' },
    });
  });

  it('通常のユーザートークンは受け付けない', async () => {
    const token = await sign(userClaims(), SECRET, 'HS256');
    const res = await call(createApp(requireProvisioningAuth), `Bearer ${token}`);

    expect(res.status).toBe(401);
  });

  it.each([
    ['provider が未知の値', { provider: 'facebook' }],
    ['provider が無い', { provider: undefined }],
    ['アカウントIDが無い', { provider_account_id: undefined }],
    ['アカウントIDが空', { provider_account_id: '' }],
    ['メールが無い', { email: undefined }],
    ['メールが空', { email: '' }],
  ])('%s なら401', async (_label, override) => {
    const token = await sign({ ...provisioningClaims(), ...override }, SECRET, 'HS256');
    const res = await call(createApp(requireProvisioningAuth), `Bearer ${token}`);

    expect(res.status).toBe(401);
  });
});
