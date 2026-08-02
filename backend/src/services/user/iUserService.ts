import type { z } from '@hono/zod-openapi';
import type { OAuthProvider } from '../../middleware/auth.js';
import type { User } from '../../repositories/user/iUserRepository.js';
import type { createUserSchema } from '../../schema/User/createUserSchemaV2.js';

export type CreateUserDTO = z.infer<typeof createUserSchema>;

export type CreateUserResponseType = 'created' | 'existing' | 'migrated';

/** OAuth 認証を通ったことをフロントが署名して伝えてきたアカウント。リクエストボディと違い詐称できない。 */
export type VerifiedOAuthAccount = {
  provider: OAuthProvider;
  providerAccountId: string;
  email: string;
};

export interface CreateUserResponse {
  user: User;
  type: CreateUserResponseType;
}

export interface IUserService {
  createUser(
    userDto: CreateUserDTO,
    verifiedAccount: VerifiedOAuthAccount
  ): Promise<CreateUserResponse>;
}
