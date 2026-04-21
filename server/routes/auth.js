const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/init');
const config = require('../config');

const router = express.Router();

// 登录
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ code: 400, message: '用户名和密码不能为空' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    return res.status(401).json({ code: 401, message: '用户名或密码错误' });
  }

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) {
    return res.status(401).json({ code: 401, message: '用户名或密码错误' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, nickname: user.nickname, organization_id: user.organization_id, is_admin: user.is_admin },
    config.JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    code: 200,
    message: '登录成功',
    data: {
      token,
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        organization_id: user.organization_id,
        is_admin: user.is_admin
      },
    },
  });
});

// 获取当前用户信息
router.get('/me', require('../middleware/auth'), (req, res) => {
  // 获取用户的组织信息
  let organization = null;
  if (req.user.organization_id) {
    organization = db.prepare('SELECT * FROM organizations WHERE id = ?').get(req.user.organization_id);
  }
  // 检查是否为系统管理员
  const isSystemAdmin = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.user.id)?.is_admin === 1;
  res.json({ code: 200, data: { ...req.user, organization, is_system_admin: isSystemAdmin } });
});

// 获取用户列表（系统管理员可用，包含数据隔离）
router.get('/users', require('../middleware/auth'), (req, res) => {
  try {
    const currentUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    const isSystemAdmin = currentUser.is_admin === 1;
    const keyword = req.query.keyword || '';
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const offset = (page - 1) * pageSize;

    let where = '';
    let params = [];

    // 数据隔离：非系统管理员只能看到同组织的用户
    if (!isSystemAdmin && currentUser.organization_id) {
      where = 'WHERE u.organization_id = ?';
      params.push(currentUser.organization_id);
    }

    if (keyword) {
      const kw = `%${keyword}%`;
      if (where) {
        where += ' AND (u.username LIKE ? OR u.nickname LIKE ?)';
      } else {
        where = 'WHERE u.username LIKE ? OR u.nickname LIKE ?';
      }
      params.push(kw, kw);
    }

    const totalParams = [...params];
    const total = db.prepare(`SELECT COUNT(*) as count FROM users u ${where}`).get(...totalParams).count;

    const list = db.prepare(`
      SELECT u.id, u.username, u.nickname, u.organization_id, u.is_admin, u.created_at, u.updated_at,
        o.name as organization_name
      FROM users u
      LEFT JOIN organizations o ON o.id = u.organization_id
      ${where}
      ORDER BY u.id DESC
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);

    res.json({ code: 200, data: { list, total, page, pageSize, is_system_admin: isSystemAdmin } });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// 创建用户（系统管理员可用）
router.post('/users', require('../middleware/auth'), (req, res) => {
  try {
    const currentUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (currentUser.is_admin !== 1) {
      return res.status(403).json({ code: 403, message: '只有系统管理员可以创建用户' });
    }

    const { username, password, nickname, organization_id } = req.body;
    if (!username || !password || !nickname) {
      return res.status(400).json({ code: 400, message: '用户名、密码和昵称不能为空' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const result = db.prepare(
      'INSERT INTO users (username, password, nickname, organization_id, is_admin) VALUES (?, ?, ?, ?, 0)'
    ).run(username, hashedPassword, nickname, organization_id || null);

    res.json({ code: 200, message: '创建成功', data: { id: result.lastInsertRowid } });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ code: 400, message: '用户名已存在' });
    }
    res.status(500).json({ code: 500, message: err.message });
  }
});

// 更新用户
router.put('/users/:id', require('../middleware/auth'), (req, res) => {
  try {
    const currentUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    const isSystemAdmin = currentUser.is_admin === 1;
    const targetId = parseInt(req.params.id);

    // 只有系统管理员可以修改其他用户，普通用户只能修改自己
    if (!isSystemAdmin && currentUser.id !== targetId) {
      return res.status(403).json({ code: 403, message: '无权限修改该用户' });
    }

    const { nickname, password, organization_id, is_admin } = req.body;

    // 只有系统管理员可以修改组织和is_admin字段
    if (!isSystemAdmin && (organization_id !== undefined || is_admin !== undefined)) {
      return res.status(403).json({ code: 403, message: '无权限修改该字段' });
    }

    if (nickname) {
      db.prepare('UPDATE users SET nickname = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(nickname, targetId);
    }
    if (password) {
      const hashedPassword = bcrypt.hashSync(password, 10);
      db.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hashedPassword, targetId);
    }
    if (isSystemAdmin && organization_id !== undefined) {
      db.prepare('UPDATE users SET organization_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(organization_id, targetId);
    }
    if (isSystemAdmin && is_admin !== undefined) {
      db.prepare('UPDATE users SET is_admin = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(is_admin ? 1 : 0, targetId);
    }

    res.json({ code: 200, message: '更新成功' });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// 删除用户（系统管理员可用）
router.delete('/users/:id', require('../middleware/auth'), (req, res) => {
  try {
    const currentUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (currentUser.is_admin !== 1) {
      return res.status(403).json({ code: 403, message: '只有系统管理员可以删除用户' });
    }

    const targetId = parseInt(req.params.id);
    if (targetId === currentUser.id) {
      return res.status(400).json({ code: 400, message: '不能删除自己' });
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
    res.json({ code: 200, message: '删除成功' });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// 获取所有组织列表
router.get('/organizations', require('../middleware/auth'), (req, res) => {
  try {
    const orgs = db.prepare('SELECT * FROM organizations ORDER BY id DESC').all();
    res.json({ code: 200, data: orgs });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

module.exports = router;
