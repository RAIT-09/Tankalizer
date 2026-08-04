// サーバアクション
'use server';

import { apiFetch } from '@/lib/apiClient';
import { ProfileTypes } from '@/types/profileTypes';

/**
 * プロフィールを取得する非同期関数
 * @async
 * @function fetchProfile
 * @param {Object} params - 投稿データ取得のためのパラメータオブジェクト
 * @param {string} params.targetUserId - ターゲットユーザのID（プロフィールを取得するユーザのID）
 * @returns {Promise<ProfileTypes>} プロフィールデータを返すPromise．プロフィールが存在しない場合はnullを返す．
 */
const fetchProfile = async ({
  targetUserId,
}: {
  targetUserId: string;
}): Promise<ProfileTypes | undefined> => {
  try {
    const res = await apiFetch('/v2/profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: targetUserId,
      }),
    });

    // エラーがある場合はnullを返す
    if (!res.ok) {
      console.log(res.statusText);
      return undefined;
    }

    const json = await res.json();
    const profile: ProfileTypes = {
      userId: json.profile.user_id,
      name: json.profile.user_name,
      iconUrl: json.profile.icon_url,
      bio: json.profile.profile_text,
      isFollowing: json.profile.is_following,
      totalMiyabi: json.profile.total_miyabi,
      totalPost: json.profile.total_post,
      followingCount: json.profile.following_count,
      followerCount: json.profile.follower_count,
      isDeveloper: json.profile.is_developer ?? false,
    };
    return profile;
  } catch (error) {
    console.error(error);
    return undefined;
  }
};

export default fetchProfile;
