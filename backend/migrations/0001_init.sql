-- Tankalizer D1 スキーマ（sql/schema.sql の SQLite 版）
-- created_at は ISO 8601 UTC の TEXT（辞書順比較でカーソルページングを維持するため）
-- id の DEFAULT (UUID()) は D1 に無いためアプリ側で crypto.randomUUID() を渡す

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(name) <= 20),
  oauth_app TEXT NOT NULL CHECK (oauth_app IN ('github', 'google')),
  connect_info TEXT NOT NULL,
  profile_text TEXT,
  icon_url TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  old_icon_url TEXT,

  UNIQUE (connect_info, oauth_app),
  UNIQUE (old_icon_url)
);

CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  original TEXT NOT NULL,
  tanka TEXT NOT NULL, -- JSON 文字列（mysql2 の自動パース相当はアプリ層で行う）
  image_path TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  is_deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_posts_created ON posts(created_at);
CREATE INDEX idx_posts_user_created ON posts(user_id, created_at);

CREATE TABLE miyabis (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE ON UPDATE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),

  UNIQUE (user_id, post_id)
);
CREATE INDEX idx_miyabis_post ON miyabis(post_id);

CREATE TABLE developers (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  developer_since TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE follows (
  follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  followee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  followed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),

  PRIMARY KEY (follower_id, followee_id)
);
CREATE INDEX idx_follows_followee ON follows(followee_id);
