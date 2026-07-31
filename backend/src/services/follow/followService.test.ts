import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IFollowRepository } from '../../repositories/follow/iFollowRepository.js';
import { FollowError } from './iFollowService.js';
import { FollowService } from './followService.js';

const createService = () => {
  const repository = {
    createFollow: vi.fn(),
    deleteFollow: vi.fn(),
    isFollowing: vi.fn(),
  } as unknown as IFollowRepository;

  return { repository, service: new FollowService(repository) };
};

describe('FollowService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  describe('followUser', () => {
    it('フォロー関係を作成して成功を返す', async () => {
      const { repository, service } = createService();
      vi.mocked(repository.isFollowing).mockResolvedValue(false);

      const result = await service.followUser('follower-1', 'followee-1');

      expect(result).toEqual({ success: true });
      expect(repository.isFollowing).toHaveBeenCalledWith('follower-1', 'followee-1');
      expect(repository.createFollow).toHaveBeenCalledWith('follower-1', 'followee-1');
    });

    it('自分自身へのフォローはリポジトリを呼ばずエラー結果を返す', async () => {
      const { repository, service } = createService();

      const result = await service.followUser('user-1', 'user-1');

      expect(result).toEqual({
        success: false,
        error: FollowError.SELF_FOLLOW,
        message: '自分自身をフォローすることはできません',
      });
      expect(repository.isFollowing).not.toHaveBeenCalled();
      expect(repository.createFollow).not.toHaveBeenCalled();
    });

    it('既存のフォロー関係がある場合はエラー結果を返す', async () => {
      const { repository, service } = createService();
      vi.mocked(repository.isFollowing).mockResolvedValue(true);

      const result = await service.followUser('follower-1', 'followee-1');

      expect(result).toEqual({
        success: false,
        error: FollowError.ALREADY_FOLLOWING,
        message: '既にフォローしています',
      });
      expect(repository.isFollowing).toHaveBeenCalledWith('follower-1', 'followee-1');
      expect(repository.createFollow).not.toHaveBeenCalled();
    });

    it('外部キー制約エラーをユーザー不在の結果へ変換する', async () => {
      const { repository, service } = createService();
      vi.mocked(repository.isFollowing).mockResolvedValue(false);
      vi.mocked(repository.createFollow).mockRejectedValue({ code: 'ER_NO_REFERENCED_ROW_2' });

      const result = await service.followUser('follower-1', 'missing-user');

      expect(result).toEqual({
        success: false,
        error: FollowError.USER_NOT_FOUND,
        message: 'ユーザーが見つかりません',
      });
      expect(repository.createFollow).toHaveBeenCalledWith('follower-1', 'missing-user');
    });

    it('その他の例外をデータベースエラー結果へ変換する', async () => {
      const { repository, service } = createService();
      vi.mocked(repository.isFollowing).mockRejectedValue(new Error('connection lost'));

      const result = await service.followUser('follower-1', 'followee-1');

      expect(result).toEqual({
        success: false,
        error: FollowError.DATABASE_ERROR,
        message: 'データベースエラーが発生しました',
      });
      expect(repository.isFollowing).toHaveBeenCalledWith('follower-1', 'followee-1');
      expect(repository.createFollow).not.toHaveBeenCalled();
    });
  });

  describe('unfollowUser', () => {
    it('フォロー関係を削除して成功を返す', async () => {
      const { repository, service } = createService();
      vi.mocked(repository.isFollowing).mockResolvedValue(true);

      const result = await service.unfollowUser('follower-1', 'followee-1');

      expect(result).toEqual({ success: true });
      expect(repository.isFollowing).toHaveBeenCalledWith('follower-1', 'followee-1');
      expect(repository.deleteFollow).toHaveBeenCalledWith('follower-1', 'followee-1');
    });

    it('フォロー関係がない場合はエラー結果を返す', async () => {
      const { repository, service } = createService();
      vi.mocked(repository.isFollowing).mockResolvedValue(false);

      const result = await service.unfollowUser('follower-1', 'followee-1');

      expect(result).toEqual({
        success: false,
        error: FollowError.NOT_FOLLOWING,
        message: 'フォロー関係が存在しません',
      });
      expect(repository.isFollowing).toHaveBeenCalledWith('follower-1', 'followee-1');
      expect(repository.deleteFollow).not.toHaveBeenCalled();
    });

    it('例外をデータベースエラー結果へ変換する', async () => {
      const { repository, service } = createService();
      vi.mocked(repository.isFollowing).mockResolvedValue(true);
      vi.mocked(repository.deleteFollow).mockRejectedValue(new Error('connection lost'));

      const result = await service.unfollowUser('follower-1', 'followee-1');

      expect(result).toEqual({
        success: false,
        error: FollowError.DATABASE_ERROR,
        message: 'データベースエラーが発生しました',
      });
      expect(repository.deleteFollow).toHaveBeenCalledWith('follower-1', 'followee-1');
    });
  });
});
