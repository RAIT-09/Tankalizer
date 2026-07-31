import { type IPostRepository, type CreatePostRepoDTO, type Post } from './iPostRepository.js';
import db from '../../lib/db.js';
import { TABLES } from '../../config/tables.js';
import type { GetPostRepoDTO } from '../../repositories/post/iPostRepository.js';
import mysql from 'mysql2';

export class PostRepository implements IPostRepository {
  /**
   * 投稿IDをもとに投稿を1件検索する
   * @param id - ID (UUID形式)
   * @returns {Promise<Post | null>} 投稿が見つかった場合はPostオブジェクト，見つからなければnull
   */
  async findById(id: string, dbc?: mysql.Connection): Promise<Post | null> {
    const query = `
      SELECT * FROM ${TABLES.posts}
      WHERE id = :id AND is_deleted = FALSE
      LIMIT 1;
    `;
    const option = { id };
    let results;
    if (dbc) {
      // トランザクション中の場合
      results = await db.queryOnConnection<Post | null>(dbc, query, option);
    } else {
      // 通常の場合
      results = await db.query<Post | null>(query, option);
    }
    return results[0] || null;
  }

  /**
   * 新しい投稿をDBに作成する
   * @param postRepoDto - 作成する投稿のデータ (CreatePostDTO)
   * @returns {Promise<void>}
   */
  async create(postRepoDto: CreatePostRepoDTO): Promise<void> {
    const sql = `
      INSERT INTO ${TABLES.posts}
        (original, tanka, image_path, user_id)
      VALUES
        (:original, :tanka, :image_path, :user_id);
    `;

    try {
      const values = {
        original: postRepoDto.original,
        tanka: JSON.stringify(postRepoDto.tanka),
        image_path: postRepoDto.image_path,
        user_id: postRepoDto.user_id,
      };

      await db.query(sql, values);
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
      await db.query(sql, { id, userId });
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

    const params: Record<string, any> = { limit };
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
      const results = await db.query(sql, params);

      // DBから取得した結果を，定義した型に合わせて整形
      return results.map((row: any) => ({
        ...row,
        is_developer: Boolean(row.is_developer),
        is_miyabi: Boolean(row.is_miyabi),
      }));
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
    const params: Record<string, any> = { id };
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
      const results = await db.query(sql, { id, viewerId });

      // DBから取得した結果を，定義した型に合わせて整形
      const posts: Post[] = results.map((row: any) => ({
        ...row,
        is_developer: Boolean(row.is_developer),
        is_miyabi: Boolean(row.is_miyabi),
      }));

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
    const params: Record<string, any> = { limit, viewerId };
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
      const results = await db.query(sql, params);

      // DBから取得した結果を，定義した型に合わせて整形
      return results.map((row: any) => ({
        ...row,
        is_developer: Boolean(row.is_developer),
        is_miyabi: Boolean(row.is_miyabi),
      }));
    } catch (error) {
      console.error(`[PostRepository#getFollowingPosts] 投稿の取得に失敗しました．`, error);
      throw new Error('データベースからの投稿取得処理に失敗しました．');
    }
  }
}
