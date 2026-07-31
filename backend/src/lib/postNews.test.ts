import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfig } from '../config/env.js';
import type { Container } from '../di/container.js';
import postNews from './postNews.js';

const { getNewsMock } = vi.hoisted(() => ({
  getNewsMock: vi.fn(),
}));

vi.mock('./getNews.js', () => ({
  default: getNewsMock,
}));

const config: AppConfig = {
  NODE_ENV: 'test',
  FRONTEND_URL: 'https://example.com',
  GEMINI_API_KEY: 'gemini-key',
  NEWS_POST_API_KEY: 'news-api-key',
  NEWS_USER_ID: 'news-user',
  S3_ACCESS_KEY_ID: 's3-access-key',
  S3_SECRET_ACCESS_KEY: 's3-secret-key',
  S3_BUCKET_NAME: 'bucket',
  CDN_URL: 'https://cdn.example.com',
  OUR_ID: 'our-user',
  DEFAULT_ICON_PATH: 'icons/default.png',
};

const createContainer = () => {
  const createPost = vi.fn();
  const container = {
    postService: {
      createPost,
    },
  } as unknown as Container;

  return { container, createPost };
};

describe('postNews', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('APIキーが一致しない場合はニュースを取得せず認証失敗を返す', async () => {
    const { container, createPost } = createContainer();

    const result = await postNews('wrong-key', container, config);

    expect(result).toEqual({
      isAuthorized: false,
      isSuccess: false,
      tanka: {
        line0: 'APIキーが間違っています',
        line1: '',
        line2: '',
        line3: '',
        line4: '',
      },
    });
    expect(getNewsMock).not.toHaveBeenCalled();
    expect(createPost).not.toHaveBeenCalled();
  });

  it('ニュース取得に失敗した場合は投稿せず失敗結果を返す', async () => {
    const { container, createPost } = createContainer();
    getNewsMock.mockResolvedValue({ isSuccess: false, message: 'RSS unavailable' });

    const result = await postNews('news-api-key', container, config);

    expect(result).toEqual({
      isAuthorized: true,
      isSuccess: false,
      tanka: {
        line0: 'ニュースの取得に失敗しました',
        line1: '',
        line2: '',
        line3: '',
        line4: '',
      },
    });
    expect(getNewsMock).toHaveBeenCalledWith('test');
    expect(createPost).not.toHaveBeenCalled();
  });

  it('取得したニュースを投稿し、短歌を行ごとのオブジェクトで返す', async () => {
    const { container, createPost } = createContainer();
    getNewsMock.mockResolvedValue({
      isSuccess: true,
      news: {
        title: 'ニュースタイトル',
        description: 'ニュース本文',
        url: 'https://news.example.com/article',
      },
    });
    createPost.mockResolvedValue({
      message: '投稿しました．',
      tanka: ['一の句', '二の句', '三の句', '四の句', '五の句'],
    });

    const result = await postNews('news-api-key', container, config);

    expect(result).toEqual({
      isAuthorized: true,
      isSuccess: true,
      tanka: {
        line0: '一の句',
        line1: '二の句',
        line2: '三の句',
        line3: '四の句',
        line4: '五の句',
      },
    });
    expect(getNewsMock).toHaveBeenCalledWith('test');
    expect(createPost).toHaveBeenCalledWith({
      original: 'ニュースタイトル\nニュース本文\nhttps://news.example.com/article',
      image: null,
      user_id: 'news-user',
    });
  });
});
