export type CreateUserRepoDTO = {
  id: string;
  name: string;
  oauth_app: 'github' | 'google';
  connect_info: string;
  profile_text?: string | null;
  icon_url: string;
  provider_account_id: string;
};

export type User = {
  id: string;
  name: string;
  oauth_app: 'github' | 'google';
  connect_info: string;
  profile_text: string | null;
  icon_url: string;
  created_at: string;
  // 0002 以前に作られたユーザーは未記録なので、次回ログイン時に紐付ける
  provider_account_id: string | null;
};

export interface IUserRepository {
  findByEmail(connect_info: string, oauth_app: 'github' | 'google'): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  findByOldIconUrl(oldIconUrl: string): Promise<User | null>;
  create(user: CreateUserRepoDTO): Promise<void>;
  updateConnectInfoAndIcon(
    id: string,
    connect_info: string,
    oauth_app: 'github' | 'google',
    icon_url: string,
    provider_account_id: string
  ): Promise<void>;
  linkProviderAccount(id: string, provider_account_id: string): Promise<void>;
}
