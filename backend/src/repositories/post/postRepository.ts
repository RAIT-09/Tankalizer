import { type IPostRepository, type CreatePostRepoDTO, type Post } from './iPostRepository.js';
import { TABLES } from '../../config/tables.js';
import type { GetPostRepoDTO } from '../../repositories/post/iPostRepository.js';
import type { DbClient } from '../../lib/dbClient.js';
import { generateUuid } from '../../utils/generateUuid.js';

type PostRow = Omit<Post, 'tanka' | 'is_developer' | 'is_miyabi'> & {
  tanka: string;
  is_developer?: number | boolean;
  is_miyabi?: number | boolean;
};

const rowToPost = (row: PostRow): Post => ({
  ...row,
  tanka: JSON.parse(row.tanka),
  is_developer: Boolean(row.is_developer),
  is_miyabi: Boolean(row.is_miyabi),
});

export class PostRepository implements IPostRepository {
  constructor(private readonly db: DbClient) {}

  /**
   * 投稿IDをもとに投稿を1件検索する
   * @param id - ID (UUID形式)
   * @returns {Promise<Post | null>} 投稿が見つかった場合はPostオブジェクト，見つからなければnull
   */
  async findById(id: string): Promise<Post | null> {
    const query = `
      SELECT * FROM ${TABLES.posts}
      WHERE id = :id AND is_deleted = FALSE
      LIMIT 1;
    `;
    const results = await this.db.query<PostRow>(query, { id });
    return results[0] ? rowToPost(results[0]) : null;
  }

  /**
   * 新しい投稿をDBに作成する
   * @param postRepoDto - 作成する投稿のデータ (CreatePostDTO)
   * @returns {Promise<void>}
   */
  async create(postRepoDto: CreatePostRepoDTO): Promise<void> {
    const sql = `
      INSERT INTO ${TABLES.posts}
        (id, original, tanka, image_path, user_id)
      VALUES
        (:id, :original, :tanka, :image_path, :user_id);
    `;

    try {
      const values = {
        id: generateUuid(),
        original: postRepoDto.original,
        tanka: JSON.stringify(postRepoDto.tanka),
        image_path: postRepoDto.image_path ?? null,
        user_id: postRepoDto.user_id,
      };

      await this.db.run(sql, values);
      console.log(
        `[PostRepository#create] 投稿の作成に成功しました．(userId: ${postRepoDto.user_id})`
      );
    } catch (error) {
      console.error(
        `[PostRepository#create] 投稿の作成に失敗しました．(userId: ${postRepoDto.user_id})`,
        error
      );
      throw error;
    }
  }

  /**
   * 投稿を削除（削除フラグをONに）する
   * @param id - 投稿ID
   * @param userId - ユーザーID
   * @returns {Promise<void>}
   */
  async delete(id: string, userId: string): Promise<void> {
    const sql = `
      UPDATE ${TABLES.posts}
      SET is_deleted = TRUE
      WHERE id = :id AND user_id = :userId;
    `;
    try {
      await this.db.run(sql, { id, userId });
      console.log(`[PostRepository#delete] 投稿の削除に成功しました．(postId: ${id})`);
    } catch (error) {
      console.error(`[PostRepository#delete] 投稿の削除に失敗しました．(postId: ${id})`, error);
      throw error;
    }
  }

  /**
   * 投稿を取得する
   * @param dto - 取得条件 (GetPostsRepoDTO)
   * @returns {Promise<Post[]>} 投稿の配列
   */
  async getPost(dto: GetPostRepoDTO): Promise<Post[]> {
    const { limit, cursor, filterByUserId, viewerId } = dto;

    const params: Record<string, unknown> = { limit };
    const whereClauses: string[] = ['posts.is_deleted = FALSE'];

    // WHERE句を動的に組み立てる
    if (filterByUserId) {
      whereClauses.push(`posts.user_id = :filterByUserId`);
      params.filterByUserId = filterByUserId;
    }
    if (cursor) {
      // 指定されたカーソル（投稿ID）より作成日時が古い投稿を取得
      whereClauses.push(
        `posts.created_at < (SELECT created_at FROM ${TABLES.posts} WHERE id = :cursor)`
      );
      params.cursor = cursor;
    }

    // LEFT JOINを動的に組み立てる
    // viewerIdが指定されている時だけ，miyabisテーブルを正しくJOINして is_miyabi を判定する
    let miyabiJoinClause: string;
    if (viewerId) {
      miyabiJoinClause = `LEFT JOIN ${TABLES.miyabis} AS miyabi ON posts.id = miyabi.post_id AND miyabi.user_id = :viewerId`;
      params.viewerId = viewerId;
    } else {
      // viewerIdがなければ is_miyabi は常に false になる
      miyabiJoinClause = `LEFT JOIN ${TABLES.miyabis} AS miyabi ON 1 = 0`;
    }

    // 最終的なSQL文を組み立てる
    const sql = `
      SELECT
        posts.id,
        posts.original,
        posts.tanka,
        posts.image_path,
        posts.created_at,
        posts.user_id,
        users.name AS user_name,
        users.icon_url AS user_icon,
        (SELECT COUNT(*) FROM ${TABLES.miyabis} WHERE post_id = posts.id) AS miyabi_count,
        CASE WHEN miyabi.id IS NOT NULL THEN TRUE ELSE FALSE END AS is_miyabi,
        CASE WHEN developers.user_id IS NOT NULL THEN TRUE ELSE FALSE END AS is_developer
      FROM
        ${TABLES.posts} AS posts
      JOIN
        ${TABLES.users} AS users ON posts.user_id = users.id
      ${miyabiJoinClause}
      LEFT JOIN
        ${TABLES.developers} AS developers ON posts.user_id = developers.user_id
      WHERE
        ${whereClauses.join(' AND ')}
      ORDER BY
        posts.created_at DESC
      LIMIT
        :limit
    `;

    try {
      const results = await this.db.query<PostRow>(sql, params);

      return results.map(rowToPost);
    } catch (error) {
      console.error(`[PostRepository#getPosts] 投稿の取得に失敗しました．`, error);
      throw new Error('データベースからの投稿取得処理に失敗しました．');
    }
  }

  /**
   * 投稿を1つだけ取得する
   * @param id - 投稿id
   * @param viewerId - 閲覧者のid
   * @returns {Promise<Post>} 投稿
   */
  async getOnePost(id: string, viewerId?: string): Promise<Post> {
    const params: Record<string, unknown> = { id };
    const whereClauses: string[] = ['posts.is_deleted = FALSE', `posts.id = :id`];

    // LEFT JOINを動的に組み立てる
    // viewerIdが指定されている時だけ，miyabisテーブルを正しくJOINして is_miyabi を判定する
    let miyabiJoinClause: string;
    if (viewerId) {
      miyabiJoinClause = `LEFT JOIN ${TABLES.miyabis} AS miyabi ON posts.id = miyabi.post_id AND miyabi.user_id = :viewerId`;
      params.viewerId = viewerId;
    } else {
      // viewerIdがなければ is_miyabi は常に false になる
      miyabiJoinClause = `LEFT JOIN ${TABLES.miyabis} AS miyabi ON 1 = 0`;
    }

    // ここからDBのpostテーブルから情報取得
    const sql = `
      SELECT
        posts.id,
        posts.original,
        posts.tanka,
        posts.image_path,
        posts.created_at,
        posts.user_id,
        users.name AS user_name,
        users.icon_url AS user_icon,
        (SELECT COUNT(*) FROM ${TABLES.miyabis} WHERE post_id = posts.id) AS miyabi_count,
        CASE WHEN miyabi.id IS NOT NULL THEN TRUE ELSE FALSE END AS is_miyabi,
        CASE WHEN developers.user_id IS NOT NULL THEN TRUE ELSE FALSE END AS is_developer  
      FROM
        ${TABLES.posts} AS posts
      JOIN
        ${TABLES.users} AS users ON posts.user_id = users.id
      ${miyabiJoinClause}
      LEFT JOIN
        ${TABLES.developers} AS developers ON posts.user_id = developers.user_id
      WHERE
        ${whereClauses.join(' AND ')}
    `;

    try {
      const results = await this.db.query<PostRow>(sql, params);

      const posts = results.map(rowToPost);

      return posts[0];
    } catch (error) {
      console.error(`[PostRepository#getPost] 投稿の取得に失敗しました．`, error);
      throw new Error('データベースからの投稿取得処理に失敗しました．');
    }
  }

  /**
   * フォローしているユーザーの投稿を取得する
   * @param limit - 取得する投稿の数
   * @param viewerId - 閲覧者のユーザーid
   * @param cursor - どの投稿より古いのを取得するか指定する投稿id
   * @returns {Promise<Post[]>} 投稿の配列
   */
  async getFollowingPost(limit: number, viewerId: string, cursor?: string | null): Promise<Post[]> {
    const params: Record<string, unknown> = { limit, viewerId };
    const whereClauses: string[] = [
      'posts.is_deleted = FALSE',
      `follows.follower_id = :viewerId`, // 閲覧者がフォローしているユーザーに絞り込む
    ];

    // WHERE句を動的に組み立てる
    if (cursor) {
      // 指定されたカーソル（投稿ID）より作成日時が古い投稿を取得
      whereClauses.push(
        `posts.created_at < (SELECT created_at FROM ${TABLES.posts} WHERE id = :cursor)`
      );
      params.cursor = cursor;
    }

    // LEFT JOINを動的に組み立てる
    // viewerIdが指定されている時だけ，miyabisテーブルを正しくJOINして is_miyabi を判定する
    let miyabiJoinClause: string;
    if (viewerId) {
      miyabiJoinClause = `LEFT JOIN ${TABLES.miyabis} AS miyabi ON posts.id = miyabi.post_id AND miyabi.user_id = :viewerId`;
      params.viewerId = viewerId;
    } else {
      // viewerIdがなければ is_miyabi は常に false になる
      miyabiJoinClause = `LEFT JOIN ${TABLES.miyabis} AS miyabi ON 1 = 0`;
    }

    // 最終的なSQL文を組み立てる
    const sql = `
      SELECT
        posts.id,
        posts.original,
        posts.tanka,
        posts.image_path,
        posts.created_at,
        posts.user_id,
        users.name AS user_name,
        users.icon_url AS user_icon,
        (EXISTS (SELECT 1 FROM ${TABLES.developers} WHERE user_id = posts.user_id)) AS is_developer,
        (SELECT COUNT(*) FROM ${TABLES.miyabis} WHERE post_id = posts.id) AS miyabi_count,
        CASE WHEN miyabi.id IS NOT NULL THEN TRUE ELSE FALSE END AS is_miyabi
      FROM
        ${TABLES.posts} AS posts
      INNER JOIN
        ${TABLES.follows} AS follows ON posts.user_id = follows.followee_id
      INNER JOIN
        ${TABLES.users} AS users ON posts.user_id = users.id
      ${miyabiJoinClause}
      WHERE
        ${whereClauses.join(' AND ')}
      ORDER BY
        posts.created_at DESC
      LIMIT
        :limit
    `;

    try {
      const results = await this.db.query<PostRow>(sql, params);

      return results.map(rowToPost);
    } catch (error) {
      console.error(`[PostRepository#getFollowingPosts] 投稿の取得に失敗しました．`, error);
      throw new Error('データベースからの投稿取得処理に失敗しました．');
    }
  }
}
