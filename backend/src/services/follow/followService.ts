import type { IFollowService, FollowResult, UnfollowResult } from './iFollowService.js';
import { FollowError } from './iFollowService.js';
import type { IFollowRepository } from '../../repositories/follow/iFollowRepository.js';

// フォロー機能のサービス実装クラス

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : '';

export class FollowService implements IFollowService {
  // リポジトリをコンストラクタで注入（依存性注入）
  constructor(private followRepository: IFollowRepository) {}

  /**
   * ユーザをフォローする処理
   * ・自分自身のフォローは禁止
   * ・重複フォローは禁止
   */
  async followUser(followerId: string, followeeId: string): Promise<FollowResult> {
    try {
      // 自分自身のフォローをチェック
      if (followerId === followeeId) {
        return {
          success: false,
          error: FollowError.SELF_FOLLOW,
          message: '自分自身をフォローすることはできません',
        };
      }

      // 既にフォローしているかチェック
      const isAlreadyFollowing = await this.followRepository.isFollowing(followerId, followeeId);
      if (isAlreadyFollowing) {
        return {
          success: false,
          error: FollowError.ALREADY_FOLLOWING,
          message: '既にフォローしています',
        };
      }

      // フォロー関係を作成（FOREIGN KEY制約でユーザー存在チェックされる）
      await this.followRepository.createFollow(followerId, followeeId);
      return { success: true };
    } catch (error: unknown) {
      console.error(error);
      const message = getErrorMessage(error);

      if (message.includes('UNIQUE constraint failed')) {
        return {
          success: false,
          error: FollowError.ALREADY_FOLLOWING,
          message: '既にフォローしています',
        };
      }

      if (message.includes('FOREIGN KEY constraint failed')) {
        return {
          success: false,
          error: FollowError.USER_NOT_FOUND,
          message: 'ユーザーが見つかりません',
        };
      }

      // その他のデータベースエラー
      return {
        success: false,
        error: FollowError.DATABASE_ERROR,
        message: 'データベースエラーが発生しました',
      };
    }
  }

  /**
   * ユーザのフォローを解除する処理
   * ・フォローしていない場合は解除できない
   */
  async unfollowUser(followerId: string, followeeId: string): Promise<UnfollowResult> {
    try {
      // フォローしているかチェック
      const isFollowing = await this.followRepository.isFollowing(followerId, followeeId);
      if (!isFollowing) {
        return {
          success: false,
          error: FollowError.NOT_FOLLOWING,
          message: 'フォロー関係が存在しません',
        };
      }

      // フォロー関係を削除
      const changes = await this.followRepository.deleteFollow(followerId, followeeId);
      if (changes === 0) {
        return {
          success: false,
          error: FollowError.NOT_FOLLOWING,
          message: 'フォロー関係が存在しません',
        };
      }
      return { success: true };
    } catch (error: unknown) {
      console.error(error);

      // その他のデータベースエラー
      return {
        success: false,
        error: FollowError.DATABASE_ERROR,
        message: 'データベースエラーが発生しました',
      };
    }
  }
}
