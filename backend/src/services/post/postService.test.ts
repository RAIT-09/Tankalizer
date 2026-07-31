import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IImageService } from '../image/iImageService.js';
import type { IPostRepository, Post } from '../../repositories/post/iPostRepository.js';
import type { IUserRepository, User } from '../../repositories/user/iUserRepository.js';
import { NotFoundError } from './iPostService.js';
import { PostService } from './postService.js';

const { compressImageMock, generateTankaMock } = vi.hoisted(() => ({
  compressImageMock: vi.fn(),
  generateTankaMock: vi.fn(),
}));

vi.mock('../../lib/gemini.js', () => ({
  default: generateTankaMock,
}));

vi.mock('../../utils/compressImage.js', () => ({
  compressImage: compressImageMock,
}));

const tanka = ['春の風', '川面をわたり', '花ゆれて', '遠き山まで', '光をはこぶ'];

const post: Post = {
  id: 'post-1',
  original: '春のニュース',
  tanka,
  image_path: null,
  created_at: new Date('2025-01-01T00:00:00Z'),
  user_id: 'user-1',
  user_name: 'ユーザー',
  user_icon: 'icons/user.png',
  is_developer: false,
  miyabi_count: 2,
  is_miyabi: true,
};

const user: User = {
  id: 'viewer-1',
  name: '閲覧者',
  oauth_app: 'github',
  connect_info: 'viewer@example.com',
  profile_text: null,
  icon_url: 'icons/viewer.png',
  created_at: new Date('2025-01-01T00:00:00Z'),
};

const createDependencies = () => {
  const postRepository = {
    findById: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    getPost: vi.fn(),
    getOnePost: vi.fn(),
    getFollowingPost: vi.fn(),
  } as unknown as IPostRepository;
  const imageService = {
    uploadImage: vi.fn(),
    getImage: vi.fn(),
    isImage: vi.fn(),
  } as unknown as IImageService;
  const userRepository = {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    findByOldIconUrl: vi.fn(),
    create: vi.fn(),
    updateConnectInfoAndIcon: vi.fn(),
  } as unknown as IUserRepository;

  return {
    postRepository,
    imageService,
    userRepository,
    service: new PostService(postRepository, imageService, userRepository, 'gemini-key'),
  };
};

describe('PostService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateTankaMock.mockResolvedValue({ isSuccess: true, tanka });
    compressImageMock.mockImplementation(async (file: File) => file);
  });

  describe('createPost', () => {
    it('画像なしで短歌を生成し投稿を作成する', async () => {
      const { service, postRepository, imageService } = createDependencies();

      const result = await service.createPost({
        original: '春のニュース',
        image: null,
        user_id: 'user-1',
      });

      expect(result).toEqual({ message: '投稿しました．', tanka });
      expect(compressImageMock).not.toHaveBeenCalled();
      expect(imageService.uploadImage).not.toHaveBeenCalled();
      expect(generateTankaMock).toHaveBeenCalledWith('春のニュース', null, 'gemini-key');
      expect(postRepository.create).toHaveBeenCalledWith({
        original: '春のニュース',
        tanka,
        image_path: null,
        user_id: 'user-1',
      });
    });

    it('画像を圧縮・アップロードして生成した短歌とともに投稿を作成する', async () => {
      const { service, postRepository, imageService } = createDependencies();
      const image = new File(['image'], 'photo.png', { type: 'image/png' });
      const compressedImage = new File(['compressed'], 'photo.webp', { type: 'image/webp' });
      compressImageMock.mockResolvedValue(compressedImage);
      vi.mocked(imageService.uploadImage).mockResolvedValue('posts/photo.webp');

      const result = await service.createPost({
        original: '春のニュース',
        image,
        user_id: 'user-1',
      });

      expect(result).toEqual({ message: '投稿しました．', tanka });
      expect(compressImageMock).toHaveBeenCalledWith(image);
      expect(imageService.uploadImage).toHaveBeenCalledWith(compressedImage);
      expect(generateTankaMock).toHaveBeenCalledWith(
        '春のニュース',
        compressedImage,
        'gemini-key'
      );
      expect(postRepository.create).toHaveBeenCalledWith({
        original: '春のニュース',
        tanka,
        image_path: 'posts/photo.webp',
        user_id: 'user-1',
      });
    });

    it('短歌生成の失敗結果をメッセージ付きErrorとして投げる', async () => {
      const { service, postRepository } = createDependencies();
      generateTankaMock.mockResolvedValue({ isSuccess: false, message: 'quota exceeded' });

      const error = await service
        .createPost({ original: '春のニュース', image: null, user_id: 'user-1' })
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(Error);
      expect(error).toMatchObject({
        name: 'Error',
        message: '短歌の生成に失敗しました: quota exceeded',
      });
      expect(generateTankaMock).toHaveBeenCalledWith('春のニュース', null, 'gemini-key');
      expect(postRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('deletePost', () => {
    it('投稿者本人の投稿を削除して結果を返す', async () => {
      const { service, postRepository } = createDependencies();
      vi.mocked(postRepository.findById).mockResolvedValue(post);

      const result = await service.deletePost({ post_id: 'post-1', user_id: 'user-1' });

      expect(result).toEqual({ message: '投稿を削除しました．' });
      expect(postRepository.findById).toHaveBeenCalledWith('post-1');
      expect(postRepository.delete).toHaveBeenCalledWith('post-1', 'user-1');
    });

    it('投稿が存在しない場合はErrorを投げる', async () => {
      const { service, postRepository } = createDependencies();
      vi.mocked(postRepository.findById).mockResolvedValue(null);

      const error = await service
        .deletePost({ post_id: 'missing-post', user_id: 'user-1' })
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(Error);
      expect(error).toMatchObject({ name: 'Error', message: '投稿が見つかりません．' });
      expect(postRepository.findById).toHaveBeenCalledWith('missing-post');
      expect(postRepository.delete).not.toHaveBeenCalled();
    });

    it('投稿者以外からの削除ではErrorを投げる', async () => {
      const { service, postRepository } = createDependencies();
      vi.mocked(postRepository.findById).mockResolvedValue(post);

      const error = await service
        .deletePost({ post_id: 'post-1', user_id: 'other-user' })
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(Error);
      expect(error).toMatchObject({ name: 'Error', message: '許可がありません．' });
      expect(postRepository.findById).toHaveBeenCalledWith('post-1');
      expect(postRepository.delete).not.toHaveBeenCalled();
    });
  });

  it('getPostはDTOをそのままリポジトリへ渡して投稿一覧を返す', async () => {
    const { service, postRepository } = createDependencies();
    const dto = {
      limit: 10,
      cursor: 'cursor-1',
      filterByUserId: 'user-1',
      viewerId: 'viewer-1',
    };
    vi.mocked(postRepository.getPost).mockResolvedValue([post]);

    const result = await service.getPost(dto);

    expect(result).toEqual([post]);
    expect(postRepository.getPost).toHaveBeenCalledWith(dto);
  });

  it('getOnePostは投稿IDと閲覧者IDを渡して投稿を返す', async () => {
    const { service, postRepository } = createDependencies();
    vi.mocked(postRepository.getOnePost).mockResolvedValue(post);

    const result = await service.getOnePost({ id: 'post-1', viewerId: 'viewer-1' });

    expect(result).toEqual(post);
    expect(postRepository.getOnePost).toHaveBeenCalledWith('post-1', 'viewer-1');
  });

  describe('getFollowingPost', () => {
    it('閲覧者を確認してフォロー中ユーザーの投稿一覧を返す', async () => {
      const { service, postRepository, userRepository } = createDependencies();
      vi.mocked(userRepository.findById).mockResolvedValue(user);
      vi.mocked(postRepository.getFollowingPost).mockResolvedValue([post]);

      const result = await service.getFollowingPost({
        limit: 20,
        viewerId: 'viewer-1',
        cursor: 'cursor-1',
      });

      expect(result).toEqual([post]);
      expect(userRepository.findById).toHaveBeenCalledWith('viewer-1');
      expect(postRepository.getFollowingPost).toHaveBeenCalledWith(
        20,
        'viewer-1',
        'cursor-1'
      );
    });

    it('閲覧者が存在しない場合はNotFoundErrorを投げる', async () => {
      const { service, postRepository, userRepository } = createDependencies();
      vi.mocked(userRepository.findById).mockResolvedValue(null);

      const error = await service
        .getFollowingPost({ limit: 20, viewerId: 'missing-viewer' })
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(NotFoundError);
      expect(error).toMatchObject({ name: 'NotFoundError', message: 'ユーザーが見つかりません．' });
      expect(userRepository.findById).toHaveBeenCalledWith('missing-viewer');
      expect(postRepository.getFollowingPost).not.toHaveBeenCalled();
    });
  });
});
