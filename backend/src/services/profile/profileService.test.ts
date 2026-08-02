import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IIconService } from '../icon/iIconService.js';
import type { IProfileRepository, Profile } from '../../repositories/profile/iProfileRepository.js';
import type { IUserRepository, User } from '../../repositories/user/iUserRepository.js';
import { NotFoundError } from './iProfileService.js';
import { ProfileService } from './profileService.js';

const { compressIconImageMock } = vi.hoisted(() => ({
  compressIconImageMock: vi.fn(),
}));

vi.mock('../../utils/compressImage.js', () => ({
  compressIconImage: compressIconImageMock,
}));

const user: User = {
  id: 'user-1',
  name: 'ユーザー',
  oauth_app: 'github',
  connect_info: 'user@example.com',
  profile_text: '自己紹介',
  icon_url: 'icons/current.png',
  created_at: '2025-01-01T00:00:00Z',
  provider_account_id: null,
};

const viewer: User = {
  ...user,
  id: 'viewer-1',
  connect_info: 'viewer@example.com',
};

const profile: Profile = {
  user_id: 'user-1',
  user_name: 'ユーザー',
  profile_text: '自己紹介',
  icon_url: 'icons/current.png',
  created_at: '2025-01-01T00:00:00Z',
  is_developer: false,
  total_miyabi: 12,
  total_post: 3,
  following_count: 4,
  follower_count: 5,
  is_following: true,
};

const createDependencies = () => {
  const profileRepository = {
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
    getFollowingUser: vi.fn(),
    getMutualFollowingUser: vi.fn(),
  } as unknown as IProfileRepository;
  const userRepository = {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    findByOldIconUrl: vi.fn(),
    create: vi.fn(),
    updateConnectInfoAndIcon: vi.fn(),
  } as unknown as IUserRepository;
  const iconService = {
    updatedIcon: vi.fn(),
    getIcon: vi.fn(),
  } as unknown as IIconService;

  return {
    profileRepository,
    userRepository,
    iconService,
    service: new ProfileService(profileRepository, userRepository, iconService),
  };
};

describe('ProfileService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    compressIconImageMock.mockImplementation(async (file: File) => file);
  });

  describe('getProfile', () => {
    it('対象ユーザーと閲覧者を確認してプロフィールを返す', async () => {
      const { service, profileRepository, userRepository } = createDependencies();
      vi.mocked(userRepository.findById)
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce(viewer);
      vi.mocked(profileRepository.getProfile).mockResolvedValue(profile);

      const result = await service.getProfile({ user_id: 'user-1', viewer_id: 'viewer-1' });

      expect(result).toEqual(profile);
      expect(userRepository.findById).toHaveBeenNthCalledWith(1, 'user-1');
      expect(userRepository.findById).toHaveBeenNthCalledWith(2, 'viewer-1');
      expect(profileRepository.getProfile).toHaveBeenCalledWith('user-1', 'viewer-1');
    });

    it('閲覧者が未指定の場合は対象ユーザーだけを確認する', async () => {
      const { service, profileRepository, userRepository } = createDependencies();
      vi.mocked(userRepository.findById).mockResolvedValue(user);
      vi.mocked(profileRepository.getProfile).mockResolvedValue(profile);

      const result = await service.getProfile({ user_id: 'user-1' });

      expect(result).toEqual(profile);
      expect(userRepository.findById).toHaveBeenCalledOnce();
      expect(userRepository.findById).toHaveBeenCalledWith('user-1');
      expect(profileRepository.getProfile).toHaveBeenCalledWith('user-1', undefined);
    });

    it('対象ユーザーが存在しない場合はNotFoundErrorを投げる', async () => {
      const { service, profileRepository, userRepository } = createDependencies();
      vi.mocked(userRepository.findById).mockResolvedValue(null);

      const error = await service
        .getProfile({ user_id: 'missing-user', viewer_id: 'viewer-1' })
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(NotFoundError);
      expect(error).toMatchObject({ name: 'NotFoundError', message: 'ユーザーが見つかりません．' });
      expect(userRepository.findById).toHaveBeenCalledWith('missing-user');
      expect(profileRepository.getProfile).not.toHaveBeenCalled();
    });

    it('閲覧者が存在しない場合はNotFoundErrorを投げる', async () => {
      const { service, profileRepository, userRepository } = createDependencies();
      vi.mocked(userRepository.findById).mockResolvedValueOnce(user).mockResolvedValueOnce(null);

      const error = await service
        .getProfile({ user_id: 'user-1', viewer_id: 'missing-viewer' })
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(NotFoundError);
      expect(error).toMatchObject({ name: 'NotFoundError', message: 'ユーザーが見つかりません．' });
      expect(userRepository.findById).toHaveBeenNthCalledWith(1, 'user-1');
      expect(userRepository.findById).toHaveBeenNthCalledWith(2, 'missing-viewer');
      expect(profileRepository.getProfile).not.toHaveBeenCalled();
    });
  });

  describe('updateProfile', () => {
    it('アイコン未指定の場合は現在のアイコンでプロフィールを更新する', async () => {
      const { service, profileRepository, userRepository, iconService } = createDependencies();
      const updatedProfile = { ...profile, user_name: '更新名', profile_text: '更新文' };
      vi.mocked(userRepository.findById).mockResolvedValue(user);
      vi.mocked(profileRepository.getProfile).mockResolvedValue(updatedProfile);

      const result = await service.updateProfile({
        user_id: 'user-1',
        user_name: '更新名',
        profile_text: '更新文',
        icon_image: null,
      });

      expect(result).toEqual(updatedProfile);
      expect(iconService.updatedIcon).not.toHaveBeenCalled();
      expect(profileRepository.updateProfile).toHaveBeenCalledWith({
        user_id: 'user-1',
        user_name: '更新名',
        profile_text: '更新文',
        image_path: 'icons/current.png',
      });
      expect(profileRepository.getProfile).toHaveBeenCalledWith('user-1', 'user-1');
    });

    it('新しいアイコンを圧縮・アップロードしてそのパスで更新する', async () => {
      const { service, profileRepository, userRepository, iconService } = createDependencies();
      const icon = new File(['new icon'], 'icon.png', { type: 'image/png' });
      const compressedIcon = new File(['compressed'], 'icon.webp', { type: 'image/webp' });
      vi.mocked(userRepository.findById).mockResolvedValue(user);
      compressIconImageMock.mockResolvedValue(compressedIcon);
      vi.mocked(iconService.updatedIcon).mockResolvedValue('icons/new.png');
      vi.mocked(profileRepository.getProfile).mockResolvedValue({
        ...profile,
        icon_url: 'icons/new.png',
      });

      const result = await service.updateProfile({
        user_id: 'user-1',
        user_name: '更新名',
        profile_text: '更新文',
        icon_image: icon,
      });

      expect(result.icon_url).toBe('icons/new.png');
      expect(compressIconImageMock).toHaveBeenCalledWith(icon);
      expect(iconService.updatedIcon).toHaveBeenCalledWith(compressedIcon, 'user-1');
      expect(profileRepository.updateProfile).toHaveBeenCalledWith({
        user_id: 'user-1',
        user_name: '更新名',
        profile_text: '更新文',
        image_path: 'icons/new.png',
      });
    });

    it('アイコンアップロードに失敗した場合は現在のアイコンで更新する', async () => {
      const { service, profileRepository, userRepository, iconService } = createDependencies();
      const icon = new File(['new icon'], 'icon.png', { type: 'image/png' });
      vi.mocked(userRepository.findById).mockResolvedValue(user);
      vi.mocked(iconService.updatedIcon).mockRejectedValue(new Error('S3 unavailable'));
      vi.mocked(profileRepository.getProfile).mockResolvedValue(profile);

      const result = await service.updateProfile({
        user_id: 'user-1',
        user_name: '更新名',
        profile_text: '更新文',
        icon_image: icon,
      });

      expect(result).toEqual(profile);
      expect(iconService.updatedIcon).toHaveBeenCalledWith(icon, 'user-1');
      expect(profileRepository.updateProfile).toHaveBeenCalledWith({
        user_id: 'user-1',
        user_name: '更新名',
        profile_text: '更新文',
        image_path: 'icons/current.png',
      });
    });

    it('ユーザーが存在しない場合はNotFoundErrorを投げる', async () => {
      const { service, profileRepository, userRepository } = createDependencies();
      vi.mocked(userRepository.findById).mockResolvedValue(null);

      const error = await service
        .updateProfile({
          user_id: 'missing-user',
          user_name: '更新名',
          profile_text: '更新文',
          icon_image: null,
        })
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(NotFoundError);
      expect(error).toMatchObject({ name: 'NotFoundError', message: 'ユーザーが見つかりません．' });
      expect(userRepository.findById).toHaveBeenCalledWith('missing-user');
      expect(profileRepository.updateProfile).not.toHaveBeenCalled();
    });
  });

  it('getFollowingUserはユーザー確認後にリポジトリの一覧を返す', async () => {
    const { service, profileRepository, userRepository } = createDependencies();
    const dto = { user_id: 'user-1', viewer_id: 'viewer-1', limit: 10, cursor: 'cursor-1' };
    vi.mocked(userRepository.findById).mockResolvedValue(user);
    vi.mocked(profileRepository.getFollowingUser).mockResolvedValue([profile]);

    const result = await service.getFollowingUser(dto);

    expect(result).toEqual([profile]);
    expect(userRepository.findById).toHaveBeenCalledWith('user-1');
    expect(profileRepository.getFollowingUser).toHaveBeenCalledWith(dto);
  });

  it('getFollowingUserはユーザー不在時にNotFoundErrorを投げる', async () => {
    const { service, profileRepository, userRepository } = createDependencies();
    const dto = { user_id: 'missing-user', limit: 10 };
    vi.mocked(userRepository.findById).mockResolvedValue(null);

    const error = await service.getFollowingUser(dto).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(NotFoundError);
    expect(error).toMatchObject({ name: 'NotFoundError', message: 'ユーザーが見つかりません．' });
    expect(userRepository.findById).toHaveBeenCalledWith('missing-user');
    expect(profileRepository.getFollowingUser).not.toHaveBeenCalled();
  });

  it('getMutualFollowingUserはユーザー確認後にリポジトリの一覧を返す', async () => {
    const { service, profileRepository, userRepository } = createDependencies();
    const dto = { user_id: 'user-1', viewer_id: 'viewer-1', limit: 5, cursor: 'cursor-1' };
    vi.mocked(userRepository.findById).mockResolvedValue(user);
    vi.mocked(profileRepository.getMutualFollowingUser).mockResolvedValue([profile]);

    const result = await service.getMutualFollowingUser(dto);

    expect(result).toEqual([profile]);
    expect(userRepository.findById).toHaveBeenCalledWith('user-1');
    expect(profileRepository.getMutualFollowingUser).toHaveBeenCalledWith(dto);
  });

  it('getMutualFollowingUserはユーザー不在時にNotFoundErrorを投げる', async () => {
    const { service, profileRepository, userRepository } = createDependencies();
    const dto = { user_id: 'missing-user', limit: 5 };
    vi.mocked(userRepository.findById).mockResolvedValue(null);

    const error = await service.getMutualFollowingUser(dto).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(NotFoundError);
    expect(error).toMatchObject({ name: 'NotFoundError', message: 'ユーザーが見つかりません．' });
    expect(userRepository.findById).toHaveBeenCalledWith('missing-user');
    expect(profileRepository.getMutualFollowingUser).not.toHaveBeenCalled();
  });
});
