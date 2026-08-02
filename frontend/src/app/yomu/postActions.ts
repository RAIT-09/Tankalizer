'use server';

import { apiFetchAsUser } from '@/lib/apiClient';

interface PostData {
  originalText: string;
  imageData?: File | null;
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

    if (data.imageData) {
      formData.append('image', data.imageData);
      res = await apiFetchAsUser('/v2/post', {
        method: 'POST',
        body: formData,
      });
    } else {
      res = await apiFetchAsUser('/v2/post', {
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
