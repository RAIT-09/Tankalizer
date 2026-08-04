// サーバアクション
'use server';

import { apiFetch } from '@/lib/apiClient';
import { ProfileTypes } from '@/types/profileTypes';

// response の型定義
interface ProfileResponse {
  user_id: string;
  user_name: string;
  profile_text: string;
  icon_url: string;
  created_at: string;
  is_following: boolean;
  total_miyabi: number;
  total_post: number;
  following_count: number;
  follower_count: number;
  is_developer?: boolean;
}

/**
 * うたトモ（相互フォロー）ユーザの一覧を取得する非同期関数
 * @async
 * @function fetchMutuals
 * @param {Object} params - うたトモユーザ取得のためのパラメータオブジェクト
 * @param {number} params.limit - 取得するユーザの最大件数
 * @param {string} params.cursor - 取得を開始するユーザのID（オフセット）
 * @returns {Promise<ProfileTypes[]>} ユーザデータの配列を返すPromise．ユーザが存在しない場合は空配列を返す．
 */
export const fetchMutuals = async ({
  limit,
  cursor,
  targetUserId,
}: {
  limit: number;
  cursor?: string;
  targetUserId?: string;
}): Promise<ProfileTypes[] | []> => {
  try {
    const res = await apiFetch('/v2/profile/mutual-following', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        limit: limit,
        cursor: cursor,
        user_id: targetUserId,
      }),
    });

    // エラーがある場合は空の配列を返す
    if (!res.ok) {
      console.log(res.statusText);
      return [];
    }

    const json = await res.json();
    return json.users.map((profile: ProfileResponse) => ({
      name: profile.user_name,
      iconUrl: profile.icon_url,
      userId: profile.user_id,
      bio: profile.profile_text,
      isFollowing: profile.is_following,
      totalMiyabi: profile.total_miyabi,
      totalPost: profile.total_post,
      followingCount: profile.following_count,
      followerCount: profile.follower_count,
      isDeveloper: profile.is_developer ?? false,
    }));
  } catch (error) {
    console.error(error);
    return [];
  }
};

/**
 * 推し歌人（フォローユーザ）の一覧を取得する非同期関数
 * @async
 * @function fetchFollowing
 * @param {Object} params - フォローユーザ取得のためのパラメータオブジェクト
 * @param {number} params.limit - 取得するユーザの最大件数
 * @param {string} params.cursor - 取得を開始するユーザのID（オフセット）
 * @returns {Promise<ProfileTypes[]>} ユーザデータの配列を返すPromise．ユーザが存在しない場合は空配列を返す．
 */
export const fetchFollowing = async ({
  limit,
  cursor,
  targetUserId,
}: {
  limit: number;
  cursor?: string;
  targetUserId?: string;
}): Promise<ProfileTypes[] | []> => {
  try {
    const res = await apiFetch('/v2/profile/following', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        limit: limit,
        cursor: cursor,
        user_id: targetUserId,
      }),
    });

    // エラーがある場合は空の配列を返す
    if (!res.ok) {
      console.log(res.statusText);
      return [];
    }

    const json = await res.json();
    return json.users.map((profile: ProfileResponse) => ({
      id: profile.user_id,
      name: profile.user_name,
      iconUrl: profile.icon_url,
      userId: profile.user_id,
      bio: profile.profile_text,
      isFollowing: profile.is_following,
      totalMiyabi: profile.total_miyabi,
      totalPost: profile.total_post,
      followingCount: profile.following_count,
      followerCount: profile.follower_count,
      isDeveloper: profile.is_developer ?? false,
    }));
  } catch (error) {
    console.error(error);
    return [];
  }
};
