import { getCloudflareContext } from '@opennextjs/cloudflare';

type ApiBinding = {
  fetch: typeof fetch;
};

const API_PREFIX = '/v2';

export const backendFetch = (path: string, init?: RequestInit): Promise<Response> => {
  const { env } = getCloudflareContext();
  const api = (env as typeof env & { API?: ApiBinding }).API;

  if (api) {
    return api.fetch(new Request(`https://tankalizer-api.internal${path}`, init));
  }

  const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:8080';
  const fallbackPath = path.startsWith(API_PREFIX) ? path.slice(API_PREFIX.length) : path;
  return fetch(`${backendUrl}${fallbackPath}`, init);
};
