import { S3Client } from '@aws-sdk/client-s3';
import type { AppConfig } from '../config/env.js';
import { FollowRepository } from '../repositories/follow/followRepository.js';
import { MiyabiRepository } from '../repositories/miyabi/miyabiRepository.js';
import { PostRepository } from '../repositories/post/postRepository.js';
import { ProfileRepository } from '../repositories/profile/profileRepository.js';
import { UserRepository } from '../repositories/user/userRepository.js';
import { FollowService } from '../services/follow/followService.js';
import type { IFollowService } from '../services/follow/iFollowService.js';
import { IconService } from '../services/icon/iconService.js';
import type { IIconService } from '../services/icon/iIconService.js';
import { ImageService } from '../services/image/imageService.js';
import type { IImageService } from '../services/image/iImageService.js';
import type { IMiyabiService } from '../services/miyabi/iMiyabiService.js';
import { MiyabiService } from '../services/miyabi/miyabiService.js';
import type { IPostService } from '../services/post/iPostService.js';
import { PostService } from '../services/post/postService.js';
import type { IProfileService } from '../services/profile/iProfileService.js';
import { ProfileService } from '../services/profile/profileService.js';
import { S3StorageService } from '../services/storage/s3StorageService.js';
import type { IStorageService } from '../services/storage/iStorageService.js';
import type { IUserService } from '../services/user/iUserService.js';
import { UserService } from '../services/user/userService.js';

export type Container = {
  followService: IFollowService;
  iconService: IIconService;
  imageService: IImageService;
  miyabiService: IMiyabiService;
  postService: IPostService;
  profileService: IProfileService;
  storageService: IStorageService;
  userService: IUserService;
};

export type AppEnv = {
  Variables: {
    container: Container;
    config: AppConfig;
  };
};

export const createContainer = (config: AppConfig): Container => {
  const followRepository = new FollowRepository();
  const miyabiRepository = new MiyabiRepository();
  const postRepository = new PostRepository();
  const profileRepository = new ProfileRepository();
  const userRepository = new UserRepository();

  const s3Client = new S3Client({
    region: 'ap-northeast-1',
    credentials: {
      accessKeyId: config.S3_ACCESS_KEY_ID,
      secretAccessKey: config.S3_SECRET_ACCESS_KEY,
    },
  });
  const storageService = new S3StorageService(
    s3Client,
    config.S3_BUCKET_NAME,
    config.CDN_URL
  );
  const iconService = new IconService(storageService);
  const imageService = new ImageService(storageService);

  return {
    followService: new FollowService(followRepository),
    iconService,
    imageService,
    miyabiService: new MiyabiService(miyabiRepository, postRepository, userRepository),
    postService: new PostService(
      postRepository,
      imageService,
      userRepository,
      config.GEMINI_API_KEY
    ),
    profileService: new ProfileService(profileRepository, userRepository, iconService),
    storageService,
    userService: new UserService(userRepository, iconService, config.DEFAULT_ICON_PATH),
  };
};
