import { OpenAPIHono } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import type { Context, ExecutionContext } from 'hono';
import { env as getRuntimeEnv } from 'hono/adapter';
import { cors } from 'hono/cors';
import { parseConfig, type AppConfig } from './config/env.js';
import {
  createContainer,
  type AppEnv,
  type Container,
} from './di/container.js';
import { DbClient } from './lib/dbClient.js';
import { runScheduledNewsPost } from './lib/postNews.js';
import { errorHandler } from './middleware/errorHandler.js';
import router from './routes/route.js';

let cachedConfig: AppConfig | undefined;
let cachedContainer: Container | undefined;

const app = new OpenAPIHono<AppEnv>();

app.use('*', async (c, next) => {
  if (!cachedConfig || !cachedContainer) {
    cachedConfig = parseConfig(getRuntimeEnv<Record<string, unknown>>(c));
    cachedContainer = createContainer(cachedConfig, new DbClient(c.env.DB));
  }

  c.set('config', cachedConfig);
  c.set('container', cachedContainer);
  await next();
});

app.use(
  '*',
  cors({
    origin: (_origin, c) => (c as Context<AppEnv>).get('config').FRONTEND_URL,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Type', 'Authorization'],
  })
);

const routedApp = app.route('/', router);

routedApp.doc('/docs/json', {
  openapi: '3.1.0',
  info: {
    title: 'Tankalizer API',
    version: '1.0.0',
    description: 'Tankalizer API description',
  },
});

routedApp.get(
  '/docs',
  swaggerUI({
    url: '/docs/json',
  })
);

routedApp.onError(errorHandler);

const scheduled = (
  _controller: unknown,
  env: AppEnv['Bindings'],
  ctx: ExecutionContext
) => {
  const config = parseConfig(env);
  const container = createContainer(config, new DbClient(env.DB));

  ctx.waitUntil(runScheduledNewsPost(container, config));
};

export default { fetch: app.fetch, scheduled };
export type AppType = typeof routedApp;
