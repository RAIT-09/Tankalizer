import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IIconService } from '../icon/iIconService.js';
import type { IUserRepository, User } from '../../repositories/user/iUserRepository.js';
import type { CreateUserDTO } from './iUserService.js';
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

const existingUser: User = {
  id: 'existing-user',
  name: '既存ユーザー',
  oauth_app: 'github',
  connect_info: 'new@example.com',
  profile_text: '既存の自己紹介',
  icon_url: 'icons/existing.png',
  created_at: new Date('2025-01-01T00:00:00Z'),
};

const createDependencies = () => {
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

    const result = await service.createUser(userDto);

    expect(result).toEqual({ user: existingUser, type: 'existing' });
    expect(userRepository.findByEmail).toHaveBeenCalledWith('new@example.com', 'github');
    expect(userRepository.findByOldIconUrl).not.toHaveBeenCalled();
    expect(userRepository.create).not.toHaveBeenCalled();
    expect(iconService.updatedIcon).not.toHaveBeenCalled();
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

    const result = await service.createUser(userDto);

    expect(result).toEqual({ user: migratedUser, type: 'migrated' });
    expect(userRepository.findByOldIconUrl).toHaveBeenCalledWith('https://example.com/icon.png');
    expect(iconService.updatedIcon).toHaveBeenCalledWith(expect.any(File), 'existing-user');
    expect(userRepository.updateConnectInfoAndIcon).toHaveBeenCalledWith(
      'existing-user',
      'new@example.com',
      'github',
      'icons/migrated.png'
    );
    expect(userRepository.findById).toHaveBeenCalledWith('existing-user');
    expect(userRepository.create).not.toHaveBeenCalled();
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

    const result = await service.createUser(userDto);

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

    const result = await service.createUser(userDto);

    expect(result).toEqual({ user: createdUser, type: 'created' });
    expect(iconService.updatedIcon).toHaveBeenCalledWith(expect.any(File), 'generated-user');
    expect(userRepository.create).toHaveBeenCalledWith({
      id: 'generated-user',
      name: '新しいユーザー',
      oauth_app: 'github',
      connect_info: 'new@example.com',
      profile_text: '自己紹介',
      icon_url: 'icons/default.png',
    });
  });

  it('作成直後にユーザーを再取得できない場合はErrorを投げる', async () => {
    const { service, userRepository, iconService } = createDependencies();
    vi.mocked(userRepository.findByEmail).mockResolvedValue(null);
    vi.mocked(userRepository.findByOldIconUrl).mockResolvedValue(null);
    vi.mocked(iconService.updatedIcon).mockResolvedValue('icons/generated-user.png');

    const error = await service.createUser(userDto).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({ name: 'Error', message: 'ユーザーの作成に失敗しました．' });
    expect(userRepository.create).toHaveBeenCalledWith({
      id: 'generated-user',
      name: '新しいユーザー',
      oauth_app: 'github',
      connect_info: 'new@example.com',
      profile_text: '自己紹介',
      icon_url: 'icons/generated-user.png',
    });
  });
});
