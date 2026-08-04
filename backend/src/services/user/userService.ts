import { type IUserService, type CreateUserDTO } from './iUserService.js';
import {
  type IUserRepository,
  type CreateUserRepoDTO,
  type User,
} from '../../repositories/user/iUserRepository.js';
import { compressIconImage } from '../../utils/compressImage.js';
import type { IIconService } from '../icon/iIconService.js';
import { generateUuid } from '../../utils/generateUuid.js';
import { UnauthorizedError } from '../../utils/errors.js';
import type { CreateUserResponse, VerifiedOAuthAccount } from './iUserService.js';

const GITHUB_AVATAR_PATTERN = /^https:\/\/avatars\.githubusercontent\.com\/u\/(\d+)(?:[/?]|$)/;

/**
 * 旧DBからの乗り換えを許可してよいかを判定する。
 * GitHub のアイコンURLは末尾にアカウントIDを含むので、OAuth で確認済みのIDと突き合わせられる。
 * Google はURLからアカウントIDを取り出せず所有を確認できないため、乗り換えを許可しない。
 */
const isOwnedByVerifiedAccount = (
  userDto: CreateUserDTO,
  verifiedAccount: VerifiedOAuthAccount
): boolean => {
  if (verifiedAccount.provider !== 'github') {
    return false;
  }

  const accountId = GITHUB_AVATAR_PATTERN.exec(userDto.icon_url)?.[1];
  return accountId !== undefined && accountId === verifiedAccount.providerAccountId;
};

export class UserService implements IUserService {
  // userRepositoryのインスタンスをコンストラクタで受け取る
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly iconService: IIconService,
    private readonly defaultIconPath: string
  ) {}

  /**
   * 新しいユーザーを作成するビジネスロジック
   * 既にユーザーが存在する場合は作成しない
   * @param userDto - ユーザー作成に必要なデータ
   * @returns {Promise<User>} 作成または取得したユーザー情報
   * @throws {Error} DBエラーなど、その他の予期せぬエラー
   */
  async createUser(
    userDto: CreateUserDTO,
    verifiedAccount: VerifiedOAuthAccount
  ): Promise<CreateUserResponse> {
    // 本文の connect_info を信じると、被害者のメールを送るだけでそのユーザーを引き当てられてしまう
    const { email: connectInfo, provider: oauthApp } = verifiedAccount;

    console.log(
      `[UserService#createUser] ユーザー作成処理を開始します．(oauth_app: ${oauthApp}, connect_info: ${connectInfo})`
    );

    // ユーザーが既に存在するかどうかをリポジトリに問い合わせる
    const existingUser = await this.userRepository.findByEmail(connectInfo, oauthApp);

    // ユーザーが既に存在した場合
    if (existingUser) {
      // メールは provider 側で別アカウントへ再割り当てされうるため、
      // 記録済みなら OAuth アカウントIDまで一致することを求める
      if (existingUser.provider_account_id === null) {
        await this.userRepository.linkProviderAccount(
          existingUser.id,
          verifiedAccount.providerAccountId
        );
      } else if (existingUser.provider_account_id !== verifiedAccount.providerAccountId) {
        console.warn(
          `[UserService#createUser] OAuthアカウントIDが一致しません．ログインを拒否します．(user_id: ${existingUser.id})`
        );
        throw new UnauthorizedError('このアカウントではログインできません．');
      }

      console.log(
        `[UserService#createUser] ユーザーは既に存在します．処理を終了します．(user_id: ${existingUser.id})`
      );
      // 既に存在するユーザー情報をそのまま返す
      return { user: existingUser, type: 'existing' };
    }

    // old_icon_urlでユーザーを検索
    const existingUserByIcon = await this.userRepository.findByOldIconUrl(userDto.icon_url);

    // old_icon_urlが一致するユーザーが存在した場合
    if (existingUserByIcon) {
      // アイコンURLは公開情報なので、それだけで既存アカウントを乗っ取れないよう
      // OAuth で確認済みのアカウントIDと一致することまで求める
      if (isOwnedByVerifiedAccount(userDto, verifiedAccount)) {
        const updatedUser = await this.updateExistingUser(
          existingUserByIcon,
          userDto,
          verifiedAccount
        );
        return { user: updatedUser, type: 'migrated' };
      }

      console.warn(
        `[UserService#createUser] old_icon_urlは一致しましたが、OAuthアカウントを確認できないため乗り換えを行いません．(user_id: ${existingUserByIcon.id})`
      );
    }

    // ユーザーが存在しない場合，リポジトリに新しいユーザーの作成を依頼する
    console.log('[UserService#createUser] 新規ユーザーを作成します．');

    const userId = generateUuid();
    const key = await this.uploadIconByUrl(userDto.icon_url, userId);

    // DB保存用データの作成
    const userRepoDto: CreateUserRepoDTO = {
      id: userId,
      name: userDto.name,
      oauth_app: oauthApp,
      connect_info: connectInfo,
      profile_text: userDto.profile_text,
      icon_url: key,
      provider_account_id: verifiedAccount.providerAccountId,
    };

    await this.userRepository.create(userRepoDto);

    // 作成したユーザー情報を再度取得して返す
    const newUser = await this.userRepository.findByEmail(connectInfo, oauthApp);

    if (!newUser) {
      // 万が一，作成直後にユーザーが見つからない場合はエラーを投げる
      console.error('[UserService#createUser] ユーザー作成直後にユーザーが見つかりませんでした．');
      throw new Error('ユーザーの作成に失敗しました．');
    }

    console.log(
      `[UserService#createUser] 新規ユーザーの作成が完了しました．(user_id: ${newUser.id})`
    );
    return { user: newUser, type: 'created' };
  }

  private async uploadIconByUrl(iconUrl: string, userId: string): Promise<string> {
    const response = await fetch(iconUrl);
    const blob = await response.blob();
    const file = new File([blob], 'icon.png', { type: 'image/png' });
    return await this.uploadIcon(file, userId);
  }

  private async uploadIcon(iconImage: File, userId: string): Promise<string> {
    try {
      if (iconImage && iconImage instanceof File) {
        // iconImageがFileのインスタンスかチェックする
        console.log('[UserService#createUser] 画像処理を実行します．');
        const compressedFile = await compressIconImage(iconImage);

        // S3にアップロード
        return await this.iconService.updatedIcon(compressedFile, userId);
      } else {
        return this.defaultIconPath;
      }
    } catch (error) {
      console.error('[UserService#uploadIcon] 画像のアップロードに失敗しました．');
      return this.defaultIconPath;
    }
  }

  /**
   * 旧データベースに登録されていたユーザーの情報を更新する
   * @param existingUser - 既存のユーザー情報
   * @param userDto - 更新するユーザー情報
   * @returns {Promise<User>} 更新後のユーザー情報
   */
  private async updateExistingUser(
    existingUser: User,
    userDto: CreateUserDTO,
    verifiedAccount: VerifiedOAuthAccount
  ): Promise<User> {
    console.log(
      `[UserService#updateExistingUser] old_icon_urlが一致するユーザーが見つかりました．情報を更新します．(user_id: ${existingUser.id})`
    );

    // アイコンをS3にアップロード
    const newIconUrl = await this.uploadIconByUrl(userDto.icon_url, existingUser.id);

    // connect_infoとicon_urlを更新
    await this.userRepository.updateConnectInfoAndIcon(
      existingUser.id,
      verifiedAccount.email,
      verifiedAccount.provider,
      newIconUrl,
      verifiedAccount.providerAccountId
    );

    // 更新後のユーザー情報を取得して返す
    const updatedUser = await this.userRepository.findById(existingUser.id);
    if (!updatedUser) {
      throw new Error('ユーザー情報の更新に失敗しました．');
    }

    console.log(
      `[UserService#updateExistingUser] ユーザー情報の更新が完了しました．(user_id: ${updatedUser.id})`
    );
    return updatedUser;
  }
}
