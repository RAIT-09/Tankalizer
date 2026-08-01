import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IMiyabiRepository, Miyabi } from '../../repositories/miyabi/iMiyabiRepository.js';
import type { IPostRepository, Post } from '../../repositories/post/iPostRepository.js';
import type { IUserRepository, User } from '../../repositories/user/iUserRepository.js';
import { ConflictError, NotFoundError } from './iMiyabiService.js';
import { MiyabiService } from './miyabiService.js';

const post: Post = {
  id: 'post-1',
  original: '原文',
  tanka: ['一', '二', '三', '四', '五'],
  image_path: null,
  created_at: '2025-01-01T00:00:00Z',
  user_id: 'author-1',
  user_name: '作者',
  user_icon: 'icons/author.png',
  is_developer: false,
  miyabi_count: 1,
  is_miyabi: false,
};

const user: User = {
  id: 'user-1',
  name: 'ユーザー',
  oauth_app: 'github',
  connect_info: 'user@example.com',
  profile_text: null,
  icon_url: 'icons/user.png',
  created_at: '2025-01-01T00:00:00Z',
};

const miyabi: Miyabi = {
  id: 'miyabi-1',
  user_id: 'user-1',
  post_id: 'post-1',
  created_at: '2025-01-02T00:00:00Z',
};

const createDependencies = () => {
  const miyabiRepository = {
    findMiyabi: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    getMiyabiRanking: vi.fn(),
  } as unknown as IMiyabiRepository;
  const postRepository = {
    findById: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    getPost: vi.fn(),
    getOnePost: vi.fn(),
    getFollowingPost: vi.fn(),
  } as unknown as IPostRepository;
  const userRepository = {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    findByOldIconUrl: vi.fn(),
    create: vi.fn(),
    updateConnectInfoAndIcon: vi.fn(),
  } as unknown as IUserRepository;

  return {
    miyabiRepository,
    postRepository,
    userRepository,
    service: new MiyabiService(miyabiRepository, postRepository, userRepository),
  };
};

describe('MiyabiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createMiyabi', () => {
    it('雅を作成して結果を返す', async () => {
      const { service, miyabiRepository, postRepository, userRepository } = createDependencies();
      vi.mocked(postRepository.findById).mockResolvedValue(post);
      vi.mocked(userRepository.findById).mockResolvedValue(user);
      vi.mocked(miyabiRepository.findMiyabi).mockResolvedValue(null);

      const result = await service.createMiyabi({ user_id: 'user-1', post_id: 'post-1' });

      expect(result).toEqual({ message: '雅を作成しました．' });
      expect(postRepository.findById).toHaveBeenCalledWith('post-1');
      expect(userRepository.findById).toHaveBeenCalledWith('user-1');
      expect(miyabiRepository.findMiyabi).toHaveBeenCalledWith('user-1', 'post-1');
      expect(miyabiRepository.create).toHaveBeenCalledWith('user-1', 'post-1');
    });

    it('投稿が存在しない場合はNotFoundErrorを投げる', async () => {
      const { service, miyabiRepository, postRepository, userRepository } = createDependencies();
      vi.mocked(postRepository.findById).mockResolvedValue(null);

      const error = await service
        .createMiyabi({ user_id: 'user-1', post_id: 'post-1' })
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(NotFoundError);
      expect(error).toMatchObject({ name: 'NotFoundError', message: '投稿が見つかりません．' });
      expect(postRepository.findById).toHaveBeenCalledWith('post-1');
      expect(userRepository.findById).not.toHaveBeenCalled();
      expect(miyabiRepository.create).not.toHaveBeenCalled();
    });

    it('ユーザーが存在しない場合はNotFoundErrorを投げる', async () => {
      const { service, miyabiRepository, postRepository, userRepository } = createDependencies();
      vi.mocked(postRepository.findById).mockResolvedValue(post);
      vi.mocked(userRepository.findById).mockResolvedValue(null);

      const error = await service
        .createMiyabi({ user_id: 'user-1', post_id: 'post-1' })
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(NotFoundError);
      expect(error).toMatchObject({ name: 'NotFoundError', message: 'ユーザーが見つかりません．' });
      expect(postRepository.findById).toHaveBeenCalledWith('post-1');
      expect(userRepository.findById).toHaveBeenCalledWith('user-1');
      expect(miyabiRepository.findMiyabi).not.toHaveBeenCalled();
      expect(miyabiRepository.create).not.toHaveBeenCalled();
    });

    it('雅が既に存在する場合はConflictErrorを投げる', async () => {
      const { service, miyabiRepository, postRepository, userRepository } = createDependencies();
      vi.mocked(postRepository.findById).mockResolvedValue(post);
      vi.mocked(userRepository.findById).mockResolvedValue(user);
      vi.mocked(miyabiRepository.findMiyabi).mockResolvedValue(null);
      vi.mocked(miyabiRepository.create).mockRejectedValue(
        new Error('UNIQUE constraint failed: miyabis.user_id, miyabis.post_id')
      );

      const error = await service
        .createMiyabi({ user_id: 'user-1', post_id: 'post-1' })
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(ConflictError);
      expect(error).toMatchObject({ name: 'ConflictError', message: '雅が既に存在します．' });
      expect(miyabiRepository.findMiyabi).toHaveBeenCalledWith('user-1', 'post-1');
      expect(miyabiRepository.create).toHaveBeenCalledWith('user-1', 'post-1');
    });
  });

  describe('deleteMiyabi', () => {
    it('雅を削除して結果を返す', async () => {
      const { service, miyabiRepository, postRepository, userRepository } = createDependencies();
      vi.mocked(miyabiRepository.findMiyabi).mockResolvedValue(miyabi);
      vi.mocked(postRepository.findById).mockResolvedValue(post);
      vi.mocked(userRepository.findById).mockResolvedValue(user);
      vi.mocked(miyabiRepository.delete).mockResolvedValue(1);

      const result = await service.deleteMiyabi({ user_id: 'user-1', post_id: 'post-1' });

      expect(result).toEqual({ message: '雅を削除しました．' });
      expect(miyabiRepository.findMiyabi).toHaveBeenCalledWith('user-1', 'post-1');
      expect(postRepository.findById).toHaveBeenCalledWith('post-1');
      expect(userRepository.findById).toHaveBeenCalledWith('user-1');
      expect(miyabiRepository.delete).toHaveBeenCalledWith('user-1', 'post-1');
    });

    it('雅が存在しない場合は投稿とユーザーを確認した後にConflictErrorを投げる', async () => {
      const { service, miyabiRepository, postRepository, userRepository } = createDependencies();
      vi.mocked(miyabiRepository.findMiyabi).mockResolvedValue(miyabi);
      vi.mocked(postRepository.findById).mockResolvedValue(post);
      vi.mocked(userRepository.findById).mockResolvedValue(user);
      vi.mocked(miyabiRepository.delete).mockResolvedValue(0);

      const error = await service
        .deleteMiyabi({ user_id: 'user-1', post_id: 'post-1' })
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(ConflictError);
      expect(error).toMatchObject({ name: 'ConflictError', message: '雅が見つかりません．' });
      expect(miyabiRepository.findMiyabi).toHaveBeenCalledWith('user-1', 'post-1');
      expect(postRepository.findById).toHaveBeenCalledWith('post-1');
      expect(userRepository.findById).toHaveBeenCalledWith('user-1');
      expect(miyabiRepository.delete).toHaveBeenCalledWith('user-1', 'post-1');
    });
  });

  it('getMiyabiRankingはリポジトリのランキングを返す', async () => {
    const { service, miyabiRepository } = createDependencies();
    const ranking = [
      {
        rank: 1,
        ...post,
        miyabi_count: 10,
      },
    ];
    vi.mocked(miyabiRepository.getMiyabiRanking).mockResolvedValue(ranking);

    const result = await service.getMiyabiRanking({ limit: 20, viewerId: 'viewer-1' });

    expect(result).toEqual(ranking);
    expect(miyabiRepository.getMiyabiRanking).toHaveBeenCalledWith(20, 'viewer-1');
  });
});
