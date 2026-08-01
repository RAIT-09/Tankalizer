// フォロー関連のリポジトリインターフェース

export interface IFollowRepository {
  /**
   * フォロー
   * @param followerId フォローする人のユーザーID
   * @param followeeId フォローされる人のユーザーID
   */
  createFollow(followerId: string, followeeId: string): Promise<void>;

  /**
   * フォロー解除
   * @param followerId フォローする人のユーザーID
   * @param followeeId フォローされる人のユーザーID
   */
  deleteFollow(followerId: string, followeeId: string): Promise<number>;

  /**
   * フォロー中かどうか
   * @param followerId フォローする人のユーザーID
   * @param followeeId フォローされる人のユーザーID
   * @returns フォロー中の場合true、そうでなければfalse
   */
  isFollowing(followerId: string, followeeId: string): Promise<boolean>;
}
