// サーバアクション
'use server';

import { backendFetch } from '@/lib/backendFetch';

/**
 * iconUrlからuserIdを取得する非同期関数
 * @async
 * @function fetchUserId
 * @param {Object} params - 投稿データ取得のためのパラメータオブジェクト
 * @param {string} params.iconUrl - ユーザのアイコン画像URL
 * @returns {Promise<string>} ユーザIDを返すPromise．ユーザが存在しない場合はnullを返す．
 */
const fetchUserId = async ({ iconUrl }: { iconUrl: string }): Promise<string> => {
  try {
    const res = await backendFetch('/v2/convert', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: iconUrl,
      }),
    });

    // エラーがある場合は空文字を返す
    if (!res.ok) {
      console.log(res.statusText);
      return ``;
    }

    const json = await res.json();
    const userId = json.output;
    return userId;
  } catch (error) {
    console.error(error);
    return '';
  }
};

export default fetchUserId;
