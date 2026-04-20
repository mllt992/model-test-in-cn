const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(path.join(dbDir, 'data.db'));

// 启用外键约束
db.pragma('foreign_keys = ON');

// 创建表
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    nickname TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS blockwords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word TEXT NOT NULL,
    category TEXT DEFAULT '',
    level INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    creator_id INTEGER,
    updater_id INTEGER,
    FOREIGN KEY (creator_id) REFERENCES users(id),
    FOREIGN KEY (updater_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question TEXT NOT NULL,
    category TEXT DEFAULT '',
    model_answer TEXT DEFAULT '',
    creator_id INTEGER,
    updater_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creator_id) REFERENCES users(id),
    FOREIGN KEY (updater_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS ai_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_base_url TEXT NOT NULL DEFAULT '',
    api_key TEXT NOT NULL DEFAULT '',
    protocol TEXT NOT NULL DEFAULT 'openai',
    model TEXT NOT NULL DEFAULT '',
    agent_prompt TEXT DEFAULT '',
    rules TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS ai_skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    enabled INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS ai_prompts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    prompt_text TEXT NOT NULL DEFAULT '',
    description TEXT DEFAULT '',
    category TEXT DEFAULT '',
    enabled INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// 数据库迁移：新增字段（兼容已有数据）
const migrate = (table, column, def) => {
  try {
    db.prepare('ALTER TABLE ' + table + ' ADD COLUMN ' + column + ' ' + def).run();
    console.log('[MIGRATE] Added column: ' + table + '.' + column);
  } catch (e) {
    if (!e.message.includes('duplicate column name')) {
      console.warn('[WARN] Migration failed for ' + table + '.' + column + ': ' + e.message);
    }
  }
};

migrate('questions', 'type', "TEXT DEFAULT ''");
migrate('questions', 'is_answered', 'INTEGER DEFAULT -1');
migrate('questions', 'is_refused', 'INTEGER DEFAULT 0');
migrate('questions', 'remark', "TEXT DEFAULT ''");
migrate('questions', 'audit_results', "TEXT DEFAULT '[]'");

migrate('ai_config', 'name', "TEXT NOT NULL DEFAULT '默认配置'");
migrate('ai_config', 'is_active', 'INTEGER NOT NULL DEFAULT 1');

// 初始化管理员账号
const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get('xrilang');
if (!existingUser) {
  const hashedPassword = bcrypt.hashSync('123456', 10);
  db.prepare('INSERT INTO users (username, password, nickname) VALUES (?, ?, ?)').run(
    'xrilang',
    hashedPassword,
    '管理员'
  );
  console.log('[SETUP] Admin account created: xrilang / 123456');
} else {
  console.log('[INFO] Admin account already exists');
}

console.log('[OK] Database initialized');
module.exports = db;
