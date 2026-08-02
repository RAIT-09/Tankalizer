-- メールアドレスは provider 側で別アカウントへ再割り当てされうるため、
-- OAuth のアカウントIDを保存して既存ログイン時に本人性を照合する。
-- 既存行は NULL のままで、次回ログイン時に記録される。
ALTER TABLE users ADD COLUMN provider_account_id TEXT;

CREATE UNIQUE INDEX idx_users_provider_account
  ON users (oauth_app, provider_account_id)
  WHERE provider_account_id IS NOT NULL;
