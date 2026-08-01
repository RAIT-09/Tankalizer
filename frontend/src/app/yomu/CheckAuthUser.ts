'use server';

import { backendFetch } from '@/lib/backendFetch';

/**
 * 認可されたユーザーかどうかを確認する
 * @param param0 ユーザーアイコンのURL
 * @returns 認可されたユーザーかどうか
 */
export const checkAuthUser = async ({ iconUrl }: { iconUrl: string }): Promise<boolean> => {
  try {
    console.log(iconUrl);

    const res = await backendFetch('/v2/isOurAccount', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ icon_url: iconUrl }),
    });

    console.log(res);

    if (!res.ok) {
      return false;
    }

    const json = await res.json();

    return json.isOurAccount;
  } catch (error) {
    console.error(error);
    return false;
  }
};
