const express = require('express');
const db = require('../database/init');

const router = express.Router();

// 列表（支持模糊搜索）
router.get('/', (req, res) => {
  const { keyword, page = 1, pageSize = 10 } = req.query;
  const offset = (page - 1) * pageSize;

  let sql = `SELECT b.*, u1.nickname as creator_name, u2.nickname as updater_name
    FROM blockwords b
    LEFT JOIN users u1 ON b.creator_id = u1.id
    LEFT JOIN users u2 ON b.updater_id = u2.id
    WHERE 1=1`;
  let countSql = 'SELECT COUNT(*) as total FROM blockwords WHERE 1=1';
  const params = [];
  const countParams = [];

  if (keyword) {
    sql += ' AND (b.word LIKE ? OR b.category LIKE ?)';
    countSql += ' AND (word LIKE ? OR category LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
    countParams.push(`%${keyword}%`, `%${keyword}%`);
  }

  sql += ' ORDER BY b.id DESC LIMIT ? OFFSET ?';
  params.push(Number(pageSize), Number(offset));

  const list = db.prepare(sql).all(...params);
  const { total } = db.prepare(countSql).get(...countParams);

  res.json({ code: 200, data: { list, total, page: Number(page), pageSize: Number(pageSize) } });
});

// 新增
router.post('/', (req, res) => {
  const { word, category = '', level = 1, creator_id } = req.body;
  if (!word) return res.status(400).json({ code: 400, message: '拦截词不能为空' });

  const result = db.prepare(
    'INSERT INTO blockwords (word, category, level, creator_id) VALUES (?, ?, ?, ?)'
  ).run(word, category, level, creator_id || null);

  res.json({ code: 200, message: '新增成功', data: { id: result.lastInsertRowid } });
});

// 更新
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { word, category, level, updater_id } = req.body;

  const existing = db.prepare('SELECT id FROM blockwords WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ code: 404, message: '记录不存在' });

  const updates = [];
  const params = [];
  if (word !== undefined) { updates.push('word = ?'); params.push(word); }
  if (category !== undefined) { updates.push('category = ?'); params.push(category); }
  if (level !== undefined) { updates.push('level = ?'); params.push(level); }
  updates.push('updated_at = CURRENT_TIMESTAMP');
  if (updater_id !== undefined) { updates.push('updater_id = ?'); params.push(updater_id); }

  params.push(id);
  db.prepare(`UPDATE blockwords SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  res.json({ code: 200, message: '更新成功' });
});

// 删除
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM blockwords WHERE id = ?').run(id);
  res.json({ code: 200, message: '删除成功' });
});

module.exports = router;
