import { type IMiyabiRepository, type Miyabi, type RankedPost } from './iMiyabiRepository.js';
import { TABLES } from '../../config/tables.js';
import type { DbClient } from '../../lib/dbClient.js';
import { generateUuid } from '../../utils/generateUuid.js';

type RankedPostRow = Omit<
  RankedPost,
  'rank' | 'tanka' | 'is_developer' | 'is_miyabi' | 'miyabi_count'
> & {
  tanka: string;
  is_developer: number | boolean;
  is_miyabi: number | boolean;
  miyabi_count: number;
};

export class MiyabiRepository implements IMiyabiRepository {
  constructor(private readonly db: DbClient) {}

  /**
   * ユーザーが特定の投稿に雅したか確認する
   * @param userId - ユーザーID
   * @param postId - 投稿ID
   * @returns {Promise<Miyabi | null>}
   */
  async findMiyabi(userId: string, postId: string): Promise<Miyabi | null> {
    const query = `
    SELECT * FROM ${TABLES.miyabis}
    WHERE user_id = :user_id AND post_id = :post_id
    LIMIT 1;
  `;
    const results = await this.db.query<Miyabi>(query, { user_id: userId, post_id: postId });

    return results[0] || null;
  }

  /**
   * 雅を作成する (投稿に雅する)
   * @param userId - ユーザーID
   * @param postId - 投稿ID
   * @returns {Promise<void>}
   */
  async create(userId: string, postId: string): Promise<void> {
    const query = `
      INSERT INTO ${TABLES.miyabis}
      (id, user_id, post_id)
      VALUES (:id, :userId, :postId);
    `;
    const option = { id: generateUuid(), userId, postId };
    try {
      await this.db.run(query, option);
      console.log(
        `[MiyabiRepository#create] 雅の作成に成功しました．(userId: ${userId}, postId: ${postId})`
      );
    } catch (error) {
      console.error(
        `[MiyabiRepository#create] 雅の作成に失敗しました．(userId: ${userId}, postId: ${postId})`,
        error
      );
      throw error;
    }
  }

  /**
   * 雅を削除する
   * @param userId - ユーザーID
   * @param postId - 投稿ID
   * @returns {Promise<number>}
   */
  async delete(userId: string, postId: string): Promise<number> {
    const query = `DELETE FROM ${TABLES.miyabis} WHERE user_id = :userId AND post_id = :postId;`;
    const option = { userId, postId };
    try {
      const { changes } = await this.db.run(query, option);
      console.log(
        `[MiyabiRepository#delete] 雅の削除に成功しました．(userId: ${userId}, postId: ${postId})`
      );
      return changes;
    } catch (error) {
      console.error(
        `[MiyabiRepository#delete] 雅の削除に失敗しました．(userId: ${userId}, postId: ${postId})`,
        error
      );
      throw error;
    }
  }

  /**
   * 雅ランキングを取得する
   * @param limit - 取得する投稿数の上限
   * @param viewerId - ビューアーのユーザーID（オプション）
   * @returns {Promise<PostWithRank[]>}
   */
  async getMiyabiRanking(limit: number, viewerId?: string): Promise<RankedPost[]> {
    const params: Record<string, unknown> = { limit };

    // viewerId が指定されている場合，閲覧者が雅済みかチェックする句を動的に生成
    let isMiyabiClause: string;
    if (viewerId) {
      isMiyabiClause = `(EXISTS (SELECT 1 FROM ${TABLES.miyabis} WHERE post_id = p.id AND user_id = :viewerId))`;
      params.viewerId = viewerId;
    } else {
      // viewerIdがなければ，is_miyabiは常にfalse
      isMiyabiClause = 'FALSE';
    }

    const sql = `
      SELECT
        p.id,
        p.original,
        p.tanka,
        p.image_path,
        p.created_at,
        p.user_id,
        u.name AS user_name,
        u.icon_url AS user_icon,
        (EXISTS (SELECT 1 FROM ${TABLES.developers} WHERE user_id = u.id)) AS is_developer,
        COUNT(m.id) AS miyabi_count,
        ${isMiyabiClause} AS is_miyabi
      FROM
        ${TABLES.posts} AS p
      -- 投稿者情報を取得するためにusersテーブルをJOIN
      JOIN
        ${TABLES.users} AS u ON p.user_id = u.id
      -- 雅の数を集計するためにmiyabisテーブルをJOIN
      JOIN
        ${TABLES.miyabis} AS m ON p.id = m.post_id
      WHERE
        -- 直近7日間の投稿に絞る
        p.created_at >= strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-7 days')
        AND p.is_deleted = FALSE
      GROUP BY
        p.id, u.id
      ORDER BY
        miyabi_count DESC, p.created_at DESC
      LIMIT :limit
    `;

    try {
      const results = await this.db.query<RankedPostRow>(sql, params);

      // 整形
      const rankedPosts: RankedPost[] = results.map((row, index) => ({
        ...row,
        tanka: JSON.parse(row.tanka),
        rank: index + 1,
        is_developer: Boolean(row.is_developer),
        is_miyabi: Boolean(row.is_miyabi),
        miyabi_count: Number(row.miyabi_count),
      }));

      return rankedPosts;
    } catch (error) {
      console.error(
        '[MiyabiRepository#getMiyabiRanking] 雅ランキングの取得に失敗しました．',
        error
      );
      throw new Error('データベースからの雅ランキング取得処理に失敗しました．');
    }
  }
}
