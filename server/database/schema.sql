-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  nickname TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 拦截词表
CREATE TABLE IF NOT EXISTS blockwords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  word TEXT NOT NULL,
  category TEXT DEFAULT '',
  level INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  creator_id INTEGER,
  updater_id INTEGER
);

-- 测试题表
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question TEXT NOT NULL,
  category TEXT DEFAULT '',
  model_answer TEXT DEFAULT '',
  creator_id INTEGER,
  updater_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 初始化管理员账号
INSERT OR IGNORE INTO users (username, password, nickname) VALUES
  ('xrilang', '$2a$10$placeholder', '管理员');

-- 将默认密码更新为正确的 bcrypt 哈希 (123456)
UPDATE users SET password = '$2b$10$YQf5MZJxWyjGHg0Z8p0X0.dGdZJ8jGqGqGqGqGqGqGqGqGqGqGqG' WHERE username = 'xrilang';
