export type CreateUserRepoDTO = {
  id: string;
  name: string;
  oauth_app: 'github' | 'google';
  connect_info: string;
  profile_text?: string | null;
  icon_url: string;
};

export type User = {
  id: string;
  name: string;
  oauth_app: 'github' | 'google';
  connect_info: string;
  profile_text: string | null;
  icon_url: string;
  created_at: string;
};

export interface IUserRepository {
  findByEmail(connect_info: string, oauth_app: 'github' | 'google'): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  findByOldIconUrl(oldIconUrl: string): Promise<User | null>;
  create(user: CreateUserRepoDTO): Promise<void>;
  updateConnectInfoAndIcon(id: string, connect_info: string, oauth_app: 'github' | 'google', icon_url: string): Promise<void>;
}
