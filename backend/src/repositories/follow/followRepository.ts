import { TABLES } from '../../config/tables.js';
import type { IFollowRepository } from './iFollowRepository.js';
import type { DbClient } from '../../lib/dbClient.js';

// フォロー機能のリポジトリ実装

export class FollowRepository implements IFollowRepository {
  constructor(private readonly db: DbClient) {}

  /**
   * フォロー関係をデータベースに保存
   * follows テーブルに新しいレコードを挿入
   * @param followerId - フォローする人のユーザーID
   * @param followeeId - フォローされる人のユーザーID
   */
  async createFollow(followerId: string, followeeId: string): Promise<void> {
    const query = `
      INSERT INTO ${TABLES.follows} (follower_id, followee_id)
      VALUES (:followerId, :followeeId)
    `;
    const params = { followerId, followeeId };

    try {
      await this.db.run(query, params);
      console.log(
        `[FollowRepository#createFollow] フォローの作成に成功しました. (${followerId} -> ${followeeId})`
      );
    } catch (error) {
      console.error(
        `[FollowRepository#createFollow] フォローの作成に失敗しました. (${followerId} -> ${followeeId})`,
        error
      );
      throw error;
    }
  }

  /**
   * フォロー関係をデータベースから削除
   * follows テーブルから該当のレコードを削除
   * @param followerId - フォローする人のユーザーID
   * @param followeeId - フォローされる人のユーザーID
   */
  async deleteFollow(followerId: string, followeeId: string): Promise<number> {
    const query = `
      DELETE FROM ${TABLES.follows}
      WHERE follower_id = :followerId AND followee_id = :followeeId
    `;
    const params = { followerId, followeeId };

    try {
      const { changes } = await this.db.run(query, params);
      console.log(
        `[FollowRepository#deleteFollow] フォローの削除に成功しました. (${followerId} -> ${followeeId})`
      );
      return changes;
    } catch (error) {
      console.error(
        `[FollowRepository#deleteFollow] フォローの削除に失敗しました. (${followerId} -> ${followeeId})`,
        error
      );
      throw error;
    }
  }

  /**
   * フォロー関係が存在するかデータベースに問い合わせ
   * COUNT(*) を使って存在チェック
   * @param followerId - フォローする人のユーザーID
   * @param followeeId - フォローされる人のユーザーID
   * @returns フォロー中の場合true、そうでなければfalse
   */
  async isFollowing(followerId: string, followeeId: string): Promise<boolean> {
    const query = `
      SELECT COUNT(*) as count
      FROM ${TABLES.follows}
      WHERE follower_id = :followerId AND followee_id = :followeeId
    `;
    const params = { followerId, followeeId };

    try {
      const result = await this.db.query<{ count: number }>(query, params);
      return result[0].count > 0; // 1以上なら true（フォロー中）
    } catch (error) {
      console.error(
        `[FollowRepository#isFollowing] フォロー状態の確認に失敗しました. (${followerId} -> ${followeeId})`,
        error
      );
      throw error;
    }
  }
}
