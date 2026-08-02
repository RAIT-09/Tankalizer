import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IIconService } from '../icon/iIconService.js';
import type { IUserRepository, User } from '../../repositories/user/iUserRepository.js';
import type { CreateUserDTO, VerifiedOAuthAccount } from './iUserService.js';
import { UnauthorizedError } from '../../utils/errors.js';
import { UserService } from './userService.js';

const { compressIconImageMock, generateUuidMock } = vi.hoisted(() => ({
  compressIconImageMock: vi.fn(),
  generateUuidMock: vi.fn(),
}));

vi.mock('../../utils/compressImage.js', () => ({
  compressIconImage: compressIconImageMock,
}));

vi.mock('../../utils/generateUuid.js', () => ({
  generateUuid: generateUuidMock,
}));

const userDto: CreateUserDTO = {
  name: '新しいユーザー',
  oauth_app: 'github',
  connect_info: 'new@example.com',
  profile_text: '自己紹介',
  icon_url: 'https://example.com/icon.png',
};

const verifiedAccount: VerifiedOAuthAccount = {
  provider: 'github',
  providerAccountId: '12345',
  email: 'new@example.com',
};

// 乗り換えは、アイコンURLのアカウントIDが OAuth で確認済みのIDと一致するときだけ許される
const migratableUserDto: CreateUserDTO = {
  ...userDto,
  icon_url: 'https://avatars.githubusercontent.com/u/12345?v=4',
};

const existingUser: User = {
  id: 'existing-user',
  name: '既存ユーザー',
  oauth_app: 'github',
  connect_info: 'new@example.com',
  profile_text: '既存の自己紹介',
  icon_url: 'icons/existing.png',
  created_at: '2025-01-01T00:00:00Z',
  provider_account_id: null,
};

const createDependencies = () => {
  const userRepository = {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    findByOldIconUrl: vi.fn(),
    create: vi.fn(),
    updateConnectInfoAndIcon: vi.fn(),
    linkProviderAccount: vi.fn(),
  } as unknown as IUserRepository;
  const iconService = {
    updatedIcon: vi.fn(),
    getIcon: vi.fn(),
  } as unknown as IIconService;

  return {
    userRepository,
    iconService,
    service: new UserService(userRepository, iconService, 'icons/default.png'),
  };
};

describe('UserService#createUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    generateUuidMock.mockReturnValue('generated-user');
    compressIconImageMock.mockImplementation(async (file: File) => file);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(new Blob(['icon']), { status: 200 }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('メールアドレスとOAuthアプリが一致する既存ユーザーをそのまま返す', async () => {
    const { service, userRepository, iconService } = createDependencies();
    vi.mocked(userRepository.findByEmail).mockResolvedValue(existingUser);

    const result = await service.createUser(userDto, verifiedAccount);

    expect(result).toEqual({ user: existingUser, type: 'existing' });
    expect(userRepository.findByEmail).toHaveBeenCalledWith('new@example.com', 'github');
    expect(userRepository.findByOldIconUrl).not.toHaveBeenCalled();
    expect(userRepository.create).not.toHaveBeenCalled();
    expect(iconService.updatedIcon).not.toHaveBeenCalled();
  });

  it('本文のconnect_infoではなくトークンのメールで既存ユーザーを引き当てる', async () => {
    const { service, userRepository } = createDependencies();
    vi.mocked(userRepository.findByEmail).mockResolvedValue(existingUser);

    // 被害者のメールを本文に入れても、引き当てに使われるのは OAuth で確認済みのメール
    await service.createUser({ ...userDto, connect_info: 'victim@example.com' }, verifiedAccount);

    expect(userRepository.findByEmail).toHaveBeenCalledWith('new@example.com', 'github');
    expect(userRepository.findByEmail).not.toHaveBeenCalledWith(
      'victim@example.com',
      expect.anything()
    );
  });

  it('記録済みのOAuthアカウントIDが一致しなければログインを拒否する', async () => {
    const { service, userRepository } = createDependencies();
    vi.mocked(userRepository.findByEmail).mockResolvedValue({
      ...existingUser,
      provider_account_id: '11111',
    });

    // メールが別アカウントへ再割り当てされても既存ユーザーには入れない
    const error = await service
      .createUser(userDto, verifiedAccount)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(userRepository.create).not.toHaveBeenCalled();
    expect(userRepository.linkProviderAccount).not.toHaveBeenCalled();
  });

  it('未記録の既存ユーザーにはOAuthアカウントIDを紐付ける', async () => {
    const { service, userRepository } = createDependencies();
    vi.mocked(userRepository.findByEmail).mockResolvedValue(existingUser);

    const result = await service.createUser(userDto, verifiedAccount);

    expect(result.type).toBe('existing');
    expect(userRepository.linkProviderAccount).toHaveBeenCalledWith('existing-user', '12345');
  });

  it('旧アイコンURLが一致するユーザーを移行して返す', async () => {
    const { service, userRepository, iconService } = createDependencies();
    const migratedUser = {
      ...existingUser,
      connect_info: 'new@example.com',
      icon_url: 'icons/migrated.png',
    };
    vi.mocked(userRepository.findByEmail).mockResolvedValue(null);
    vi.mocked(userRepository.findByOldIconUrl).mockResolvedValue(existingUser);
    vi.mocked(userRepository.findById).mockResolvedValue(migratedUser);
    vi.mocked(iconService.updatedIcon).mockResolvedValue('icons/migrated.png');

    const result = await service.createUser(migratableUserDto, verifiedAccount);

    expect(result).toEqual({ user: migratedUser, type: 'migrated' });
    expect(userRepository.findByOldIconUrl).toHaveBeenCalledWith(
      'https://avatars.githubusercontent.com/u/12345?v=4'
    );
    expect(iconService.updatedIcon).toHaveBeenCalledWith(expect.any(File), 'existing-user');
    expect(userRepository.updateConnectInfoAndIcon).toHaveBeenCalledWith(
      'existing-user',
      'new@example.com',
      'github',
      'icons/migrated.png',
      '12345'
    );
    expect(userRepository.findById).toHaveBeenCalledWith('existing-user');
    expect(userRepository.create).not.toHaveBeenCalled();
  });

  it('旧アイコンURLが一致してもOAuthアカウントIDが違えば移行しない', async () => {
    const { service, userRepository, iconService } = createDependencies();
    const createdUser: User = { ...existingUser, id: 'generated-user' };
    vi.mocked(userRepository.findByEmail)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(createdUser);
    vi.mocked(userRepository.findByOldIconUrl).mockResolvedValue(existingUser);
    vi.mocked(iconService.updatedIcon).mockResolvedValue('icons/generated-user.png');

    // 被害者のアイコンURLを知っていても、OAuth を通っていなければ乗っ取れない
    const result = await service.createUser(migratableUserDto, {
      provider: 'github',
      providerAccountId: '99999',
      email: 'attacker@example.com',
    });

    expect(result.type).toBe('created');
    expect(userRepository.updateConnectInfoAndIcon).not.toHaveBeenCalled();
  });

  it('providerが一致しなければ移行しない', async () => {
    const { service, userRepository, iconService } = createDependencies();
    const createdUser: User = { ...existingUser, id: 'generated-user' };
    vi.mocked(userRepository.findByEmail)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(createdUser);
    vi.mocked(userRepository.findByOldIconUrl).mockResolvedValue(existingUser);
    vi.mocked(iconService.updatedIcon).mockResolvedValue('icons/generated-user.png');

    const result = await service.createUser(migratableUserDto, {
      provider: 'google',
      providerAccountId: '12345',
      email: 'attacker@example.com',
    });

    expect(result.type).toBe('created');
    expect(userRepository.updateConnectInfoAndIcon).not.toHaveBeenCalled();
  });

  it('新規ユーザーを作成し、再取得したユーザーを返す', async () => {
    const { service, userRepository, iconService } = createDependencies();
    const createdUser: User = {
      ...existingUser,
      id: 'generated-user',
      name: '新しいユーザー',
      profile_text: '自己紹介',
      icon_url: 'icons/generated-user.png',
    };
    vi.mocked(userRepository.findByEmail)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(createdUser);
    vi.mocked(userRepository.findByOldIconUrl).mockResolvedValue(null);
    vi.mocked(iconService.updatedIcon).mockResolvedValue('icons/generated-user.png');

    const result = await service.createUser(userDto, verifiedAccount);

    expect(result).toEqual({ user: createdUser, type: 'created' });
    expect(generateUuidMock).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith('https://example.com/icon.png');
    expect(compressIconImageMock).toHaveBeenCalledWith(expect.any(File));
    expect(iconService.updatedIcon).toHaveBeenCalledWith(expect.any(File), 'generated-user');
    expect(userRepository.create).toHaveBeenCalledWith({
      id: 'generated-user',
      name: '新しいユーザー',
      oauth_app: 'github',
      connect_info: 'new@example.com',
      profile_text: '自己紹介',
      icon_url: 'icons/generated-user.png',
      provider_account_id: '12345',
    });
    expect(userRepository.findByEmail).toHaveBeenNthCalledWith(1, 'new@example.com', 'github');
    expect(userRepository.findByEmail).toHaveBeenNthCalledWith(2, 'new@example.com', 'github');
  });

  it('アイコンアップロードに失敗した場合はデフォルトアイコンで新規作成する', async () => {
    const { service, userRepository, iconService } = createDependencies();
    const createdUser: User = {
      ...existingUser,
      id: 'generated-user',
      icon_url: 'icons/default.png',
    };
    vi.mocked(userRepository.findByEmail)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(createdUser);
    vi.mocked(userRepository.findByOldIconUrl).mockResolvedValue(null);
    vi.mocked(iconService.updatedIcon).mockRejectedValue(new Error('S3 unavailable'));

    const result = await service.createUser(userDto, verifiedAccount);

    expect(result).toEqual({ user: createdUser, type: 'created' });
    expect(iconService.updatedIcon).toHaveBeenCalledWith(expect.any(File), 'generated-user');
    expect(userRepository.create).toHaveBeenCalledWith({
      id: 'generated-user',
      name: '新しいユーザー',
      oauth_app: 'github',
      connect_info: 'new@example.com',
      profile_text: '自己紹介',
      icon_url: 'icons/default.png',
      provider_account_id: '12345',
    });
  });

  it('作成直後にユーザーを再取得できない場合はErrorを投げる', async () => {
    const { service, userRepository, iconService } = createDependencies();
    vi.mocked(userRepository.findByEmail).mockResolvedValue(null);
    vi.mocked(userRepository.findByOldIconUrl).mockResolvedValue(null);
    vi.mocked(iconService.updatedIcon).mockResolvedValue('icons/generated-user.png');

    const error = await service.createUser(userDto, verifiedAccount).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({ name: 'Error', message: 'ユーザーの作成に失敗しました．' });
    expect(userRepository.create).toHaveBeenCalledWith({
      id: 'generated-user',
      name: '新しいユーザー',
      oauth_app: 'github',
      connect_info: 'new@example.com',
      profile_text: '自己紹介',
      icon_url: 'icons/generated-user.png',
      provider_account_id: '12345',
    });
  });
});
