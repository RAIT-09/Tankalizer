import type { AppConfig } from '../config/env.js';
import type { Container } from '../di/container.js';
import getNews from './getNews.js';

export const runNewsPost = async (container: Container, config: AppConfig) => {
  const newsResponse = await getNews(config.NODE_ENV);

  // ニュースの取得に失敗した場合
  if (!newsResponse.isSuccess || !newsResponse.news) {
    return {
      isAuthorized: true,
      isSuccess: false,
      tanka: {
        line0: 'ニュースの取得に失敗しました',
        line1: '',
        line2: '',
        line3: '',
        line4: '',
      },
    };
  }

  const news = newsResponse.news;

  // 投稿の原文
  const originalText = `${news.title}\n${news.description}\n${news.url}`;

  console.log('originalText', originalText);

  try {
    const postResponse = await container.postService.createPost({
      original: originalText,
      image: null,
      user_id: config.NEWS_USER_ID,
    });

    console.log('postResponse', postResponse);

    return {
      isAuthorized: true,
      isSuccess: true,
      tanka: {
        line0: postResponse.tanka[0] ?? '',
        line1: postResponse.tanka[1] ?? '',
        line2: postResponse.tanka[2] ?? '',
        line3: postResponse.tanka[3] ?? '',
        line4: postResponse.tanka[4] ?? '',
      },
    };
  } catch (error) {
    console.error(error);
    return {
      isAuthorized: true,
      isSuccess: false,
      tanka: {
        line0: '投稿に失敗しました',
        line1: '',
        line2: '',
        line3: '',
        line4: '',
      },
    };
  }
};

const postNews = async (requestApiKey: string, container: Container, config: AppConfig) => {
  if (requestApiKey !== config.NEWS_POST_API_KEY) {
    return {
      isAuthorized: false,
      isSuccess: false,
      tanka: {
        line0: 'APIキーが間違っています',
        line1: '',
        line2: '',
        line3: '',
        line4: '',
      },
    };
  }

  return runNewsPost(container, config);
};

export default postNews;
