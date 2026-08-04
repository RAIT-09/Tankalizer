// サーバアクション
'use server';

import { apiFetchAsUser } from '@/lib/apiClient';

/**
 * 雅を増やす非同期関数
 * @async
 * @function addMiyabi
 * @param {Object} params - 雅追加のためのパラメータオブジェクト
 * @param {string} params.postId - 雅する投稿のID
 */
export const addMiyabi = async ({ postId }: { postId: string }) => {
  try {
    const res = await apiFetchAsUser('/v2/miyabi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        post_id: postId,
      }),
    });

    // エラーがある場合はログを出力
    if (!res.ok) {
      console.log(res.statusText);
    }
  } catch (error) {
    console.error(error);
  }
};

/**
 * 雅を減らす非同期関数
 * @async
 * @function removeMiyabi
 * @param {Object} params - 雅追加のためのパラメータオブジェクト
 * @param {string} params.postId - 雅する投稿のID
 */
export const removeMiyabi = async ({ postId }: { postId: string }) => {
  try {
    const res = await apiFetchAsUser('/v2/miyabi', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        post_id: postId,
      }),
    });

    // エラーがある場合はログを出力
    if (!res.ok) {
      console.log(res.statusText);
    }
  } catch (error) {
    console.error(error);
  }
};
