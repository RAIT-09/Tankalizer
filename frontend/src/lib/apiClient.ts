import { auth } from '@/auth/config';
import { signUserToken } from '@/lib/apiToken';
import { backendFetch } from '@/lib/backendFetch';

const unauthorized = () =>
  new Response(JSON.stringify({ message: '認証が必要です．', statusCode: 401, error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });

const withToken = async (init: RequestInit | undefined, userId: string): Promise<RequestInit> => {
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${await signUserToken(userId)}`);
  return { ...init, headers };
};

/** 閲覧系用。未ログインでも通し、ログイン済みなら viewer として扱われる。 */
export const apiFetch = async (path: string, init?: RequestInit): Promise<Response> => {
  const session = await auth();
  if (!session?.user_id) {
    return backendFetch(path, init);
  }

  return backendFetch(path, await withToken(init, session.user_id));
};

/** 更新系用。セッションが無ければバックエンドを呼ばずに 401 を返す。 */
export const apiFetchAsUser = async (path: string, init?: RequestInit): Promise<Response> => {
  const session = await auth();
  if (!session?.user_id) {
    return unauthorized();
  }

  return backendFetch(path, await withToken(init, session.user_id));
};
