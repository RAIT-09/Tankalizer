// サーバアクション
'use server';

import { apiFetch, apiFetchAsUser } from '@/lib/apiClient';
import { PostTypes } from '@/types/postTypes';

// response の型定義
interface PostResponse {
  id: string;
  original: string;
  tanka: [];
  image_path: string;
  created_at: string;
  user_name: string;
  user_icon: string;
  user_id: string;
  miyabi_count: number;
  is_miyabi: boolean;
  rank?: number;
  is_developer?: boolean;
}

/**
 * 投稿データを取得する非同期関数
 * @async
 * @function fetchPosts
 * @param {Object} params - 投稿データ取得のためのパラメータオブジェクト
 * @param {number} params.limit - 取得する投稿の最大件数
 * @param {string} params.cursor - 取得を開始する投稿のID（オフセット）
 * @param {string} params.filterByUserId - 取得する対象のユーザID
 * @returns {Promise<PostTypes[]>} 投稿データの配列を返すPromise．投稿が存在しない場合は空配列を返す．
 */
export const fetchPosts = async ({
  limit,
  cursor,
  filterByUserId,
}: {
  limit: number;
  cursor?: string;
  filterByUserId?: string;
}): Promise<PostTypes[] | []> => {
  try {
    const res = await apiFetch('/v2/timeline', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        limit: limit,
        cursor: cursor,
        filterByUserId: filterByUserId,
      }),
    });

    // エラーがある場合は空の配列を返す
    if (!res.ok) {
      console.log(res.statusText);
      return [];
    }

    const json = await res.json();
    return json.posts.map((post: PostResponse) => ({
      id: post.id,
      tanka: post.tanka,
      original: post.original,
      imageUrl: post.image_path ?? '',
      date: new Date(post.created_at),
      user: {
        name: post.user_name,
        iconUrl: post.user_icon,
        userId: post.user_id,
      },
      miyabiCount: post.miyabi_count,
      miyabiIsClicked: post.is_miyabi,
      rank: post.rank,
      isDeveloper: post.is_developer ?? false,
    }));
  } catch (error) {
    console.error(error);
    return [];
  }
};

/**
 * 雅ランキングを取得する非同期関数
 * @async
 * @function fetchRanking
 * @param {Object} params - ランキング取得のためのパラメータオブジェクト
 * @param {number} params.limit - 取得する投稿の最大件数
 * @returns {Promise<PostTypes[]>} 投稿データの配列を返すPromise．投稿が存在しない場合は空配列を返す．
 */
export const fetchRanking = async ({
  limit,
}: {
  limit: number;
}): Promise<PostTypes[] | []> => {
  try {
    const res = await apiFetch('/v2/miyabiranking', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        limit: limit,
      }),
    });

    // エラーがある場合は空の配列を返す
    if (!res.ok) {
      console.log(res.statusText);
      return [];
    }

    const json = await res.json();
    return json.ranked_posts.map((post: PostResponse) => ({
      id: post.id,
      tanka: post.tanka,
      original: post.original,
      imageUrl: post.image_path ?? '',
      date: new Date(post.created_at),
      user: {
        name: post.user_name,
        iconUrl: post.user_icon,
        userId: post.user_id,
      },
      miyabiCount: post.miyabi_count,
      miyabiIsClicked: post.is_miyabi,
      rank: post.rank,
      isDeveloper: post.is_developer ?? false,
    }));
  } catch (error) {
    console.error(error);
    return [];
  }
};

/**
 * 推し歌人（フォローユーザ）の投稿データを取得する非同期関数
 * @async
 * @function fetchPostsForFollowing
 * @param {Object} params - 投稿データ取得のためのパラメータオブジェクト
 * @param {number} params.limit - 取得する投稿の最大件数
 * @param {string} params.cursor - 取得を開始する投稿のID（オフセット）
 * @returns {Promise<PostTypes[]>} 投稿データの配列を返すPromise．投稿が存在しない場合は空配列を返す．
 */
export const fetchPostsForFollowing = async ({
  limit,
  cursor,
}: {
  limit: number;
  cursor?: string;
}): Promise<PostTypes[] | []> => {
  try {
    const res = await apiFetchAsUser('/v2/timeline/following', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        limit: limit,
        cursor: cursor,
      }),
    });

    // エラーがある場合は空の配列を返す
    if (!res.ok) {
      console.log(res.statusText);
      return [];
    }

    const json = await res.json();
    return json.posts.map((post: PostResponse) => ({
      id: post.id,
      tanka: post.tanka,
      original: post.original,
      imageUrl: post.image_path ?? '',
      date: new Date(post.created_at),
      user: {
        name: post.user_name,
        iconUrl: post.user_icon,
        userId: post.user_id,
      },
      miyabiCount: post.miyabi_count,
      miyabiIsClicked: post.is_miyabi,
      rank: post.rank,
      isDeveloper: post.is_developer ?? false,
    }));
  } catch (error) {
    console.error(error);
    return [];
  }
};
