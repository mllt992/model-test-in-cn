const express = require('express');
const router = express.Router();
const db = require('../database/init');

// 列表查询
router.get('/', (req, res) => {
  try {
    const keyword = req.query.keyword || '';
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const offset = (page - 1) * pageSize;

    let where = '';
    const params = [];
    if (keyword) {
      where = 'WHERE name LIKE ? OR description LIKE ?';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    const total = db.prepare(`SELECT COUNT(*) as count FROM organizations ${where}`).get(...params).count;
    const list = db.prepare(`
      SELECT o.*,
        (SELECT COUNT(*) FROM users WHERE organization_id = o.id) as member_count,
        (SELECT COUNT(*) FROM organization_admins WHERE organization_id = o.id) as admin_count
      FROM organizations o
      ${where}
      ORDER BY o.id DESC
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);

    res.json({ code: 200, data: { list, total, page, pageSize } });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// 获取单个组织
router.get('/:id', (req, res) => {
  try {
    const org = db.prepare(`
      SELECT o.*,
        (SELECT COUNT(*) FROM users WHERE organization_id = o.id) as member_count
      FROM organizations o WHERE o.id = ?
    `).get(req.params.id);

    if (!org) {
      return res.status(404).json({ code: 404, message: '组织不存在' });
    }

    // 获取组织管理员
    const admins = db.prepare(`
      SELECT u.id, u.username, u.nickname
      FROM organization_admins oa
      JOIN users u ON u.id = oa.user_id
      WHERE oa.organization_id = ?
    `).all(req.params.id);

    res.json({ code: 200, data: { ...org, admins } });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// 创建组织
router.post('/', (req, res) => {
  try {
    const { name, description, admin_ids } = req.body;
    if (!name) {
      return res.status(400).json({ code: 400, message: '组织名称不能为空' });
    }

    const result = db.prepare('INSERT INTO organizations (name, description) VALUES (?, ?)').run(name, description || '');

    // 添加管理员
    if (admin_ids && Array.isArray(admin_ids) && admin_ids.length > 0) {
      const insertAdmin = db.prepare('INSERT OR IGNORE INTO organization_admins (organization_id, user_id) VALUES (?, ?)');
      admin_ids.forEach(userId => {
        insertAdmin.run(result.lastInsertRowid, userId);
      });
    }

    res.json({ code: 200, message: '创建成功', data: { id: result.lastInsertRowid } });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ code: 400, message: '组织名称已存在' });
    }
    res.status(500).json({ code: 500, message: err.message });
  }
});

// 更新组织
router.put('/:id', (req, res) => {
  try {
    const { name, description, admin_ids } = req.body;
    if (!name) {
      return res.status(400).json({ code: 400, message: '组织名称不能为空' });
    }

    db.prepare('UPDATE organizations SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(name, description || '', req.params.id);

    // 更新管理员
    if (admin_ids !== undefined) {
      db.prepare('DELETE FROM organization_admins WHERE organization_id = ?').run(req.params.id);
      if (Array.isArray(admin_ids) && admin_ids.length > 0) {
        const insertAdmin = db.prepare('INSERT OR IGNORE INTO organization_admins (organization_id, user_id) VALUES (?, ?)');
        admin_ids.forEach(userId => {
          insertAdmin.run(req.params.id, userId);
        });
      }
    }

    res.json({ code: 200, message: '更新成功' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ code: 400, message: '组织名称已存在' });
    }
    res.status(500).json({ code: 500, message: err.message });
  }
});

// 删除组织
router.delete('/:id', (req, res) => {
  try {
    // 检查是否有用户
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE organization_id = ?').get(req.params.id).count;
    if (userCount > 0) {
      return res.status(400).json({ code: 400, message: '该组织下仍有用户，无法删除' });
    }

    db.prepare('DELETE FROM organizations WHERE id = ?').run(req.params.id);
    res.json({ code: 200, message: '删除成功' });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// 获取所有用户（用于选择管理员）
router.get('/users/available', (req, res) => {
  try {
    const users = db.prepare(`
      SELECT u.id, u.username, u.nickname, o.name as organization_name
      FROM users u
      LEFT JOIN organizations o ON o.id = u.organization_id
      ORDER BY u.id DESC
    `).all();

    res.json({ code: 200, data: users });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// 获取组织成员
router.get('/:id/members', (req, res) => {
  try {
    const members = db.prepare(`
      SELECT u.id, u.username, u.nickname, u.created_at,
        CASE WHEN oa.user_id IS NOT NULL THEN 1 ELSE 0 END as is_admin
      FROM users u
      LEFT JOIN organization_admins oa ON oa.user_id = u.id AND oa.organization_id = u.organization_id
      WHERE u.organization_id = ?
      ORDER BY u.id DESC
    `).all(req.params.id);

    res.json({ code: 200, data: members });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// 从组织移除用户
router.delete('/:id/members/:userId', (req, res) => {
  try {
    const { id, userId } = req.params;

    // 检查是否为最后一个管理员
    const org = db.prepare('SELECT * FROM organizations WHERE id = ?').get(id);
    const admins = db.prepare('SELECT * FROM organization_admins WHERE organization_id = ?').all(id);
    const userIsAdmin = admins.some(a => a.user_id === parseInt(userId));

    if (userIsAdmin && admins.length <= 1) {
      return res.status(400).json({ code: 400, message: '该用户是唯一的管理员，无法移除' });
    }

    // 将用户移出组织（organization_id 设为 NULL）
    db.prepare('UPDATE users SET organization_id = NULL WHERE id = ?').run(userId);
    db.prepare('DELETE FROM organization_admins WHERE organization_id = ? AND user_id = ?').run(id, userId);

    res.json({ code: 200, message: '移除成功' });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

// 添加成员到组织
router.post('/:id/members', (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ code: 400, message: '用户ID不能为空' });
    }

    // 检查用户是否已属于其他组织
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(user_id);
    if (!user) {
      return res.status(404).json({ code: 404, message: '用户不存在' });
    }
    if (user.organization_id && user.organization_id !== parseInt(id)) {
      return res.status(400).json({ code: 400, message: '该用户已属于其他组织，请先移除' });
    }

    // 更新用户的组织
    db.prepare('UPDATE users SET organization_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id, user_id);

    res.json({ code: 200, message: '添加成功' });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
});

module.exports = router;
