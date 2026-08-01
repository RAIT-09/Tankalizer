'use server';

import { backendFetch } from '@/lib/backendFetch';

interface PostData {
  originalText: string;
  imageData?: File | null;
  userId: string;
}

export interface PostResult {
  message: string;
  tanka: string[];
}

/**
 * 短歌を投稿する
 * @param data 投稿するデータ
 * @returns 投稿結果
 */
export const postYomu = async (data: PostData): Promise<PostResult> => {
  try {
    console.log(data);

    let res;

    const formData = new FormData();
    formData.append('original', data.originalText);
    formData.append('user_id', data.userId);

    if (data.imageData) {
      formData.append('image', data.imageData);
      res = await backendFetch('/v2/post', {
        method: 'POST',
        body: formData,
      });
    } else {
      res = await backendFetch('/v2/post', {
        method: 'POST',
        body: formData,
      });
    }

    console.log(res);

    if (!res.ok) {
      return {
        message: '投稿に失敗しました',
        tanka: ['', '', '', '', ''],
      };
    }

    const json = await res.json();

    console.log(json.tanka);
    return {
      message: '投稿に成功しました',
      tanka: json.tanka,
    };
  } catch (error) {
    console.error(error);
    return {
      message: '投稿に失敗しました',
      tanka: ['', '', '', '', ''],
    };
  }
};
