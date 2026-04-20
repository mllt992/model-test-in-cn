const express = require('express');
const db = require('../database/init');

const router = express.Router();

// ========== AI 配置 ==========

// 获取所有配置
router.get('/', (req, res) => {
  const list = db.prepare('SELECT * FROM ai_config ORDER BY id ASC').all();
  res.json({ code: 200, data: list });
});

// 获取当前启用的配置
router.get('/active', (req, res) => {
  const row = db.prepare('SELECT * FROM ai_config WHERE is_active = 1 LIMIT 1').get();
  res.json({ code: 200, data: row || null });
});

// 新增配置
router.post('/', (req, res) => {
  const { name, api_base_url, api_key, protocol, model, agent_prompt, rules } = req.body;
  const result = db.prepare(
    `INSERT INTO ai_config (name, api_base_url, api_key, protocol, model, agent_prompt, rules, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 0)`
  ).run(name || '未命名配置', api_base_url || '', api_key || '', protocol || 'openai', model || '', agent_prompt || '', rules || '');
  res.json({ code: 200, message: '新增成功', data: { id: result.lastInsertRowid } });
});

// 更新配置
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, api_base_url, api_key, protocol, model, agent_prompt, rules } = req.body;

  const existing = db.prepare('SELECT id FROM ai_config WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ code: 404, message: '配置不存在' });

  const updates = [];
  const params = [];
  if (name !== undefined) { updates.push('name = ?'); params.push(name); }
  if (api_base_url !== undefined) { updates.push('api_base_url = ?'); params.push(api_base_url); }
  if (api_key !== undefined) { updates.push('api_key = ?'); params.push(api_key); }
  if (protocol !== undefined) { updates.push('protocol = ?'); params.push(protocol); }
  if (model !== undefined) { updates.push('model = ?'); params.push(model); }
  if (agent_prompt !== undefined) { updates.push('agent_prompt = ?'); params.push(agent_prompt); }
  if (rules !== undefined) { updates.push('rules = ?'); params.push(rules); }
  updates.push('updated_at = CURRENT_TIMESTAMP');

  params.push(id);
  db.prepare(`UPDATE ai_config SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  res.json({ code: 200, message: '更新成功' });
});

// 启用配置（同时禁用其他所有配置）
router.put('/:id/activate', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT id FROM ai_config WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ code: 404, message: '配置不存在' });

  const setActive = db.transaction(() => {
    db.prepare('UPDATE ai_config SET is_active = 0').run();
    db.prepare('UPDATE ai_config SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
  });
  setActive();
  res.json({ code: 200, message: '已启用' });
});

// 删除配置
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const row = db.prepare('SELECT is_active FROM ai_config WHERE id = ?').get(id);
  if (row && row.is_active === 1) {
    return res.status(400).json({ code: 400, message: '不能删除当前启用的配置' });
  }
  db.prepare('DELETE FROM ai_config WHERE id = ?').run(id);
  res.json({ code: 200, message: '删除成功' });
});

// 测试连接
router.post('/test-connection', async (req, res) => {
  const { api_base_url, api_key, protocol } = req.body;
  if (!api_base_url) return res.status(400).json({ code: 400, message: 'API地址不能为空' });

  const baseUrl = api_base_url.replace(/\/+$/, '');
  try {
    let ok = false;
    if (protocol === 'gemini') {
      const resp = await fetch(`${baseUrl}/models?key=${api_key}`, { signal: AbortSignal.timeout(10000) });
      ok = resp.ok;
    } else if (protocol === 'claude') {
      const resp = await fetch(`${baseUrl}/models`, {
        headers: { 'x-api-key': api_key, 'anthropic-version': '2023-06-01' },
        signal: AbortSignal.timeout(10000),
      });
      ok = resp.ok;
    } else {
      const resp = await fetch(`${baseUrl}/models`, {
        headers: { Authorization: `Bearer ${api_key}` },
        signal: AbortSignal.timeout(10000),
      });
      ok = resp.ok;
    }
    if (ok) {
      res.json({ code: 200, message: '连接成功' });
    } else {
      res.status(400).json({ code: 400, message: '连接失败，请检查配置' });
    }
  } catch (err) {
    res.status(500).json({ code: 500, message: '连接失败: ' + err.message });
  }
});

// 拉取模型列表
router.post('/models', async (req, res) => {
  const { api_base_url, api_key, protocol } = req.body;
  if (!api_base_url) return res.status(400).json({ code: 400, message: 'API地址不能为空' });

  const baseUrl = api_base_url.replace(/\/+$/, '');
  try {
    let models = [];
    if (protocol === 'gemini') {
      const resp = await fetch(`${baseUrl}/models?key=${api_key}`, { signal: AbortSignal.timeout(15000) });
      const data = await resp.json();
      models = (data.models || []).map((m) => m.name);
    } else if (protocol === 'claude') {
      const resp = await fetch(`${baseUrl}/models`, {
        headers: { 'x-api-key': api_key, 'anthropic-version': '2023-06-01' },
        signal: AbortSignal.timeout(15000),
      });
      const data = await resp.json();
      models = (data.data || []).map((m) => m.id);
    } else {
      const resp = await fetch(`${baseUrl}/models`, {
        headers: { Authorization: `Bearer ${api_key}` },
        signal: AbortSignal.timeout(15000),
      });
      const data = await resp.json();
      models = (data.data || []).map((m) => m.id);
    }
    res.json({ code: 200, data: models });
  } catch (err) {
    res.status(500).json({ code: 500, message: '获取模型列表失败: ' + err.message });
  }
});

// ========== Skill 管理 ==========

router.get('/skills', (req, res) => {
  const list = db.prepare('SELECT * FROM ai_skills ORDER BY sort_order ASC, id ASC').all();
  res.json({ code: 200, data: list });
});

router.post('/skills', (req, res) => {
  const { name, description, content, enabled, sort_order } = req.body;
  if (!name) return res.status(400).json({ code: 400, message: '技能名称不能为空' });

  const result = db.prepare(
    'INSERT INTO ai_skills (name, description, content, enabled, sort_order) VALUES (?, ?, ?, ?, ?)'
  ).run(name, description || '', content || '', enabled !== undefined ? Number(enabled) : 1, sort_order || 0);

  res.json({ code: 200, message: '新增成功', data: { id: result.lastInsertRowid } });
});

router.put('/skills/:id', (req, res) => {
  const { id } = req.params;
  const { name, description, content, enabled, sort_order } = req.body;

  const existing = db.prepare('SELECT id FROM ai_skills WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ code: 404, message: '技能不存在' });

  const updates = [];
  const params = [];
  if (name !== undefined) { updates.push('name = ?'); params.push(name); }
  if (description !== undefined) { updates.push('description = ?'); params.push(description); }
  if (content !== undefined) { updates.push('content = ?'); params.push(content); }
  if (enabled !== undefined) { updates.push('enabled = ?'); params.push(Number(enabled)); }
  if (sort_order !== undefined) { updates.push('sort_order = ?'); params.push(Number(sort_order)); }
  updates.push('updated_at = CURRENT_TIMESTAMP');

  params.push(id);
  db.prepare(`UPDATE ai_skills SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  res.json({ code: 200, message: '更新成功' });
});

router.delete('/skills/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM ai_skills WHERE id = ?').run(id);
  res.json({ code: 200, message: '删除成功' });
});

// ========== Prompt 管理 ==========

router.get('/prompts', (req, res) => {
  const list = db.prepare('SELECT * FROM ai_prompts ORDER BY sort_order ASC, id ASC').all();
  res.json({ code: 200, data: list });
});

router.post('/prompts', (req, res) => {
  const { name, prompt_text, description, category, enabled, sort_order } = req.body;
  if (!name) return res.status(400).json({ code: 400, message: 'Prompt名称不能为空' });

  const result = db.prepare(
    'INSERT INTO ai_prompts (name, prompt_text, description, category, enabled, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(name, prompt_text || '', description || '', category || '', enabled !== undefined ? Number(enabled) : 1, sort_order || 0);

  res.json({ code: 200, message: '新增成功', data: { id: result.lastInsertRowid } });
});

router.put('/prompts/:id', (req, res) => {
  const { id } = req.params;
  const { name, prompt_text, description, category, enabled, sort_order } = req.body;

  const existing = db.prepare('SELECT id FROM ai_prompts WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ code: 404, message: 'Prompt不存在' });

  const updates = [];
  const params = [];
  if (name !== undefined) { updates.push('name = ?'); params.push(name); }
  if (prompt_text !== undefined) { updates.push('prompt_text = ?'); params.push(prompt_text); }
  if (description !== undefined) { updates.push('description = ?'); params.push(description); }
  if (category !== undefined) { updates.push('category = ?'); params.push(category); }
  if (enabled !== undefined) { updates.push('enabled = ?'); params.push(Number(enabled)); }
  if (sort_order !== undefined) { updates.push('sort_order = ?'); params.push(Number(sort_order)); }
  updates.push('updated_at = CURRENT_TIMESTAMP');

  params.push(id);
  db.prepare(`UPDATE ai_prompts SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  res.json({ code: 200, message: '更新成功' });
});

router.delete('/prompts/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM ai_prompts WHERE id = ?').run(id);
  res.json({ code: 200, message: '删除成功' });
});

module.exports = router;
