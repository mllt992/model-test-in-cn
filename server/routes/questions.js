const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const db = require('../database/init');
const config = require('../config');

const router = express.Router();

// 确保上传目录存在
if (!fs.existsSync(config.UPLOAD_DIR)) {
  fs.mkdirSync(config.UPLOAD_DIR, { recursive: true });
}

// 列表（支持模糊搜索 + 多条件筛选 + 分页）
router.get('/', (req, res) => {
  const {
    keyword,
    type,          // 类型模糊搜索
    no_type,       // 筛选未设置类型 1=是
    no_category,   // 筛选未设置类别 1=是
    is_answered,   // -1=全部, 0=未回答, 1=已回答
    is_refused,     // -1=全部, 0=未拒答, 1=已拒答
    audit_count,    // 人工审核同意数筛选
    audit_names,    // 人工审核人名模糊搜索
    page = 1,
    pageSize = 10,
  } = req.query;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  const params = [];

  if (keyword) {
    conditions.push('(q.question LIKE ? OR q.category LIKE ? OR q.model_answer LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  if (type) {
    conditions.push('q.type LIKE ?');
    params.push(`%${type}%`);
  }
  if (no_type === '1') {
    conditions.push('(q.type IS NULL OR q.type = "")');
  }
  if (no_category === '1') {
    conditions.push('(q.category IS NULL OR q.category = "")');
  }
  if (is_answered !== undefined && is_answered !== '-1' && is_answered !== '') {
    conditions.push('q.is_answered = ?');
    params.push(Number(is_answered));
  }
  if (is_refused !== undefined && is_refused !== '-1' && is_refused !== '') {
    conditions.push('q.is_refused = ?');
    params.push(Number(is_refused));
  }
  if (audit_count !== undefined && audit_count !== '') {
    conditions.push('json_array_length(q.audit_results) >= ?');
    params.push(Number(audit_count));
  }
  if (audit_names) {
    conditions.push('q.audit_results LIKE ?');
    params.push(`%${audit_names}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const list = db.prepare(
    `SELECT q.*, u1.nickname as creator_name, u2.nickname as updater_name
     FROM questions q
     LEFT JOIN users u1 ON q.creator_id = u1.id
     LEFT JOIN users u2 ON q.updater_id = u2.id
     ${where} ORDER BY q.id DESC LIMIT ? OFFSET ?`
  ).all(...params, Number(pageSize), Number(offset));

  // 拒答比例统计
  const totalParams = [...params];
  const totalResult = db.prepare(
    `SELECT COUNT(*) as total, SUM(CASE WHEN q.is_refused = 1 THEN 1 ELSE 0 END) as refused_count
     FROM questions q ${where}`
  ).get(...totalParams);

  const resultList = list.map((item, index) => ({
    ...item,
    index: offset + index + 1,
    audit_results: item.audit_results ? JSON.parse(item.audit_results) : [],
  }));

  res.json({
    code: 200,
    data: {
      list: resultList,
      total: totalResult.total,
      refused_count: totalResult.refused_count || 0,
      refusal_rate: totalResult.total ? ((totalResult.refused_count || 0) / totalResult.total * 100).toFixed(1) + '%' : '0%',
      page: Number(page),
      pageSize: Number(pageSize),
    },
  });
});

// 获取类型列表
router.get('/types', (req, res) => {
  const rows = db.prepare('SELECT DISTINCT type FROM questions WHERE type IS NOT NULL AND type != "" ORDER BY type').all();
  res.json({ code: 200, data: rows.map((r) => r.type) });
});

// 获取类别列表
router.get('/categories', (req, res) => {
  const rows = db.prepare('SELECT DISTINCT category FROM questions WHERE category IS NOT NULL AND category != "" ORDER BY category').all();
  res.json({ code: 200, data: rows.map((r) => r.category) });
});

// 新增
router.post('/', (req, res) => {
  const { question, category = '', model_answer = '', type = '', is_answered = -1, is_refused = 0, remark = '', audit_results = [], creator_id } = req.body;
  if (!question) return res.status(400).json({ code: 400, message: '题目不能为空' });

  const result = db.prepare(
    'INSERT INTO questions (question, category, model_answer, type, is_answered, is_refused, remark, audit_results, creator_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(question, category, model_answer, type, is_answered, is_refused, remark, JSON.stringify(audit_results), creator_id || null);

  res.json({ code: 200, message: '新增成功', data: { id: result.lastInsertRowid } });
});

// 批量新增（导入使用）
router.post('/batch', (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ code: 400, message: '导入数据不能为空' });
  }

  const insert = db.prepare(
    'INSERT INTO questions (question, category, model_answer, type, is_answered, is_refused, remark, audit_results, creator_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );

  const insertMany = db.transaction((records) => {
    for (const item of records) {
      insert.run(
        item.question || '',
        item.category || '',
        item.model_answer || '',
        item.type || '',
        item.is_answered !== undefined ? Number(item.is_answered) : -1,
        item.is_refused !== undefined ? Number(item.is_refused) : 0,
        item.remark || '',
        item.audit_results ? JSON.stringify(item.audit_results) : '[]',
        item.creator_id || null
      );
    }
  });

  insertMany(items);
  res.json({ code: 200, message: `成功导入 ${items.length} 条记录` });
});

// 更新
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { question, category, model_answer, type, is_answered, is_refused, remark, audit_results, updater_id } = req.body;

  const existing = db.prepare('SELECT id FROM questions WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ code: 404, message: '记录不存在' });

  const updates = [];
  const params = [];
  if (question !== undefined) { updates.push('question = ?'); params.push(question); }
  if (category !== undefined) { updates.push('category = ?'); params.push(category); }
  if (model_answer !== undefined) { updates.push('model_answer = ?'); params.push(model_answer); }
  if (type !== undefined) { updates.push('type = ?'); params.push(type); }
  if (is_answered !== undefined) { updates.push('is_answered = ?'); params.push(is_answered); }
  if (is_refused !== undefined) { updates.push('is_refused = ?'); params.push(is_refused); }
  if (remark !== undefined) { updates.push('remark = ?'); params.push(remark); }
  if (audit_results !== undefined) { updates.push('audit_results = ?'); params.push(JSON.stringify(audit_results)); }
  updates.push('updated_at = CURRENT_TIMESTAMP');
  if (updater_id !== undefined) { updates.push('updater_id = ?'); params.push(updater_id); }

  params.push(id);
  db.prepare(`UPDATE questions SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  res.json({ code: 200, message: '更新成功' });
});

// 删除
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM questions WHERE id = ?').run(id);
  res.json({ code: 200, message: '删除成功' });
});

// 批量删除
router.post('/batch-delete', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ code: 400, message: '请选择要删除的记录' });
  }

  const deleteStmt = db.prepare('DELETE FROM questions WHERE id = ?');
  const deleteMany = db.transaction((idList) => {
    for (const id of idList) {
      deleteStmt.run(id);
    }
  });

  deleteMany(ids);
  res.json({ code: 200, message: `成功删除 ${ids.length} 条记录` });
});

// 批量更新类型
router.post('/batch-update-type', (req, res) => {
  const { ids, type } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ code: 400, message: '请选择要更新的记录' });
  }

  const updateStmt = db.prepare('UPDATE questions SET type = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
  const updateMany = db.transaction((idList) => {
    for (const id of idList) {
      updateStmt.run(type, id);
    }
  });

  updateMany(ids);
  res.json({ code: 200, message: `成功更新 ${ids.length} 条记录的类型` });
});

// 批量更新类别
router.post('/batch-update-category', (req, res) => {
  const { ids, category } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ code: 400, message: '请选择要更新的记录' });
  }

  const updateStmt = db.prepare('UPDATE questions SET category = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
  const updateMany = db.transaction((idList) => {
    for (const id of idList) {
      updateStmt.run(category, id);
    }
  });

  updateMany(ids);
  res.json({ code: 200, message: `成功更新 ${ids.length} 条记录的类别` });
});

// AI回答：根据活跃AI配置调用模型生成回答
router.post('/:id/ai-answer', async (req, res) => {
  const { id } = req.params;
  const row = db.prepare('SELECT * FROM questions WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ code: 404, message: '记录不存在' });

  const aiConfig = db.prepare('SELECT * FROM ai_config WHERE is_active = 1 LIMIT 1').get();
  if (!aiConfig || !aiConfig.api_base_url || !aiConfig.api_key) {
    return res.status(400).json({ code: 400, message: '请先配置AI渠道' });
  }

  // 构建提示词
  const skills = db.prepare("SELECT * FROM ai_skills WHERE enabled = 1 ORDER BY sort_order ASC").all();
  const skillText = skills.map((s) => s.content).filter(Boolean).join('\n');
  let prompt = row.question;
  if (aiConfig.agent_prompt) prompt = aiConfig.agent_prompt + '\n' + prompt;
  if (aiConfig.rules) prompt += '\n规则：' + aiConfig.rules;
  if (skillText) prompt += '\n技能：' + skillText;

  const baseUrl = aiConfig.api_base_url.replace(/\/+$/, '');

  try {
    let aiAnswer = '';

    if (aiConfig.protocol === 'gemini') {
      const resp = await fetch(`${baseUrl}/models/${aiConfig.model}:generateContent?key=${aiConfig.api_key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        signal: AbortSignal.timeout(60000),
      });
      const data = await resp.json();
      aiAnswer = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else if (aiConfig.protocol === 'claude') {
      const resp = await fetch(`${baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': aiConfig.api_key,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: aiConfig.model,
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: AbortSignal.timeout(60000),
      });
      const data = await resp.json();
      aiAnswer = data.content?.[0]?.text || '';
    } else {
      // OpenAI / Codex 兼容
      const resp = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${aiConfig.api_key}`,
        },
        body: JSON.stringify({
          model: aiConfig.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 4096,
        }),
        signal: AbortSignal.timeout(60000),
      });
      const data = await resp.json();
      aiAnswer = data.choices?.[0]?.message?.content || '';
    }

    if (!aiAnswer) {
      return res.status(500).json({ code: 500, message: '模型返回为空' });
    }

    res.json({ code: 200, data: { ai_answer: aiAnswer, old_answer: row.model_answer || '' } });
  } catch (err) {
    res.status(500).json({ code: 500, message: 'AI调用失败: ' + err.message });
  }
});

// 同意审核
router.post('/:id/approve', (req, res) => {
  const { id } = req.params;
  const { username } = req.body;
  if (!username) return res.status(400).json({ code: 400, message: '缺少用户名' });

  const row = db.prepare('SELECT audit_results FROM questions WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ code: 404, message: '记录不存在' });

  let auditResults = row.audit_results ? JSON.parse(row.audit_results) : [];
  if (auditResults.some((a) => a.username === username)) {
    return res.status(400).json({ code: 400, message: '已同意，请勿重复操作' });
  }

  // 查询用户昵称
  const user = db.prepare('SELECT nickname FROM users WHERE username = ?').get(username);
  auditResults.push({ username, name: user ? user.nickname : username });

  db.prepare('UPDATE questions SET audit_results = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(JSON.stringify(auditResults), id);

  res.json({ code: 200, message: '已同意', data: { audit_results: auditResults } });
});

// 撤销同意
router.post('/:id/revoke-approve', (req, res) => {
  const { id } = req.params;
  const { username } = req.body;
  if (!username) return res.status(400).json({ code: 400, message: '缺少用户名' });

  const row = db.prepare('SELECT audit_results FROM questions WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ code: 404, message: '记录不存在' });

  let auditResults = row.audit_results ? JSON.parse(row.audit_results) : [];
  auditResults = auditResults.filter((a) => a.username !== username);

  db.prepare('UPDATE questions SET audit_results = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(JSON.stringify(auditResults), id);

  res.json({ code: 200, message: '已撤销同意', data: { audit_results: auditResults } });
});

// 重复检测
router.get('/duplicates', (req, res) => {
  const rows = db.prepare(
    `SELECT id, question, category, type, model_answer, is_refused, audit_results, created_at
     FROM questions WHERE question IN (
       SELECT question FROM questions GROUP BY question HAVING COUNT(*) > 1
     ) ORDER BY question, id ASC`
  ).all();

  const groups = {};
  rows.forEach((r) => {
    if (!groups[r.question]) groups[r.question] = [];
    groups[r.question].push({
      ...r,
      audit_results: r.audit_results ? JSON.parse(r.audit_results) : [],
    });
  });

  const result = Object.entries(groups).map(([question, items]) => ({
    question,
    count: items.length,
    items,
  }));

  res.json({ code: 200, data: result });
});

// 删除重复（每组保留id最小的记录）
router.post('/remove-duplicates', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ code: 400, message: '请选择要删除的记录' });
  }

  const deleteStmt = db.prepare('DELETE FROM questions WHERE id = ?');
  const deleteMany = db.transaction((idList) => {
    for (const id of idList) deleteStmt.run(id);
  });
  deleteMany(ids);

  res.json({ code: 200, message: `成功删除 ${ids.length} 条重复记录` });
});

// 导出
router.post('/export', (req, res) => {
  const { columns, format = 'xlsx', keyword, type, is_answered, is_refused, audit_count, audit_names } = req.body;

  if (!columns || !Array.isArray(columns) || columns.length === 0) {
    return res.status(400).json({ code: 400, message: '导出列不能为空' });
  }

  const conditions = [];
  const params = [];
  if (keyword) {
    conditions.push('(q.question LIKE ? OR q.category LIKE ? OR q.model_answer LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  if (type) {
    conditions.push('q.type LIKE ?');
    params.push(`%${type}%`);
  }
  if (is_answered !== undefined && is_answered !== '-1' && is_answered !== '') {
    conditions.push('q.is_answered = ?');
    params.push(Number(is_answered));
  }
  if (is_refused !== undefined && is_refused !== '-1' && is_refused !== '') {
    conditions.push('q.is_refused = ?');
    params.push(Number(is_refused));
  }
  if (audit_count !== undefined && audit_count !== '') {
    conditions.push('json_array_length(q.audit_results) >= ?');
    params.push(Number(audit_count));
  }
  if (audit_names) {
    conditions.push('q.audit_results LIKE ?');
    params.push(`%${audit_names}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const data = db.prepare(
    `SELECT q.*, u1.nickname as creator_name, u2.nickname as updater_name
     FROM questions q
     LEFT JOIN users u1 ON q.creator_id = u1.id
     LEFT JOIN users u2 ON q.updater_id = u2.id
     ${where} ORDER BY q.id DESC`
  ).all(...params);

  // 列名映射
  const fieldMap = {
    id: 'id', index: 'index', type: 'type', question: 'question', category: 'category',
    model_answer: 'model_answer', is_answered: 'is_answered', is_refused: 'is_refused',
    remark: 'remark', audit_results: 'audit_results',
    creator_name: 'creator_name', updater_name: 'updater_name',
    created_at: 'created_at', updated_at: 'updated_at',
  };

  // 是否回答 / 是否拒答 映射
  const answeredMap = { '-1': '全部', '0': '否', '1': '是' };
  const refusedMap = { '0': '否', '1': '是' };

  const exportData = data.map((item, idx) => {
    const row = {};
    columns.forEach((col) => {
      const field = fieldMap[col.key];
      if (field === 'index') {
        row[col.label] = idx + 1;
      } else if (field === 'is_answered') {
        row[col.label] = answeredMap[String(item.is_answered)] ?? String(item.is_answered);
      } else if (field === 'is_refused') {
        row[col.label] = refusedMap[String(item.is_refused)] ?? String(item.is_refused);
      } else if (field === 'audit_results') {
        const parsed = item.audit_results ? JSON.parse(item.audit_results) : [];
        row[col.label] = parsed.map((a) => a.name).join(', ');
      } else {
        row[col.label] = item[field] ?? '';
      }
    });
    return row;
  });

  if (format === 'xlsx') {
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '测试题');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=questions.xlsx');
    return res.send(buf);
  }

  if (format === 'csv') {
    const ws = XLSX.utils.json_to_sheet(exportData);
    const csv = XLSX.utils.sheet_to_csv(ws, { FS: ',' });
    // UTF-8 BOM 解决 Excel 打开 CSV 中文乱码
    res.setHeader('Content-Type', 'text/csv;charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=questions.csv');
    return res.send('\ufeff' + csv);
  }

  // JSON
  res.json({ code: 200, data: exportData });
});

// 导入文件上传配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).substring(2)}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// 导入预览（上传文件 → 返回 Sheet 列表、列名、前5行数据）
router.post('/import/preview', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ code: 400, message: '请上传文件' });

  const ext = path.extname(req.file.originalname).toLowerCase();

  try {
    const sheets = [];

    if (ext === '.xlsx' || ext === '.xls') {
      const workbook = XLSX.readFile(req.file.path, { cellDates: true });
      workbook.SheetNames.forEach((name) => {
        const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: '' });
        const headers = rawData.length > 0 ? rawData[0].map((h) => String(h).trim()) : [];
        const preview = rawData.slice(1, 6).map((row) =>
          headers.map((_, i) => row[i] ?? '')
        );
        sheets.push({ name, headers, preview, totalRows: Math.max(rawData.length - 1, 0) });
      });
    } else if (ext === '.csv') {
      const content = fs.readFileSync(req.file.path, 'utf-8');
      const rawData = parseCSV(content);
      const headers = rawData.length > 0 ? rawData[0].map((h) => String(h).trim()) : [];
      const preview = rawData.slice(1, 6).map((row) =>
        headers.map((_, i) => row[i] ?? '')
      );
      sheets.push({ name: 'CSV', headers, preview, totalRows: Math.max(rawData.length - 1, 0) });
    } else if (ext === '.json') {
      const content = fs.readFileSync(req.file.path, 'utf-8');
      const rawData = JSON.parse(content);
      const arr = Array.isArray(rawData) ? rawData : [rawData];
      const headers = arr.length > 0 ? Object.keys(arr[0]) : [];
      const preview = arr.slice(0, 5).map((row) =>
        headers.map((h) => row[h] ?? '')
      );
      sheets.push({ name: 'JSON', headers, preview, totalRows: arr.length });
    } else {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ code: 400, message: '不支持的文件格式' });
    }

    fs.unlinkSync(req.file.path);
    res.json({ code: 200, data: { sheets, fileName: req.file.originalname } });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(500).json({ code: 500, message: `解析失败: ${err.message}` });
  }
});

// 导入（文件上传 + 解析 + 映射）
router.post('/import', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ code: 400, message: '请上传文件' });

  const { fieldMapping, defaultValues, sheetName } = req.body;
  let mapping = {};
  let defaults = {};
  try { mapping = JSON.parse(fieldMapping || '{}'); } catch (e) { mapping = {}; }
  try { defaults = JSON.parse(defaultValues || '{}'); } catch (e) { defaults = {}; }

  const ext = path.extname(req.file.originalname).toLowerCase();

  try {
    let rawData = [];

    if (ext === '.xlsx' || ext === '.xls') {
      const workbook = XLSX.readFile(req.file.path, { cellDates: true });
      const targetSheet = sheetName || workbook.SheetNames[0];
      rawData = XLSX.utils.sheet_to_json(workbook.Sheets[targetSheet], { header: 1, defval: '' });
    } else if (ext === '.csv') {
      const content = fs.readFileSync(req.file.path, 'utf-8');
      rawData = parseCSV(content);
    } else if (ext === '.json') {
      const content = fs.readFileSync(req.file.path, 'utf-8');
      rawData = JSON.parse(content);
    } else {
      return res.status(400).json({ code: 400, message: '不支持的文件格式' });
    }

    // 删除临时文件
    fs.unlinkSync(req.file.path);

    let records = [];

    if (ext === '.xlsx' || ext === '.xls' || ext === '.csv') {
      if (rawData.length < 2) return res.json({ code: 200, data: [], headers: [], message: '数据为空' });
      const headers = rawData[0].map((h) => String(h).trim());
      const dataRows = rawData.slice(1);

      records = dataRows.map((row) => {
        const record = {};
        headers.forEach((header, i) => {
          const mappedField = mapping[header] || header;
          record[mappedField] = row[i] ?? '';
        });
        // 应用默认值（已映射的字段若为空也用默认值）
        Object.keys(defaults).forEach((field) => {
          if (!record[field] || String(record[field]).trim() === '') {
            record[field] = defaults[field];
          }
        });
        return record;
      });
    } else {
      records = Array.isArray(rawData) ? rawData : [rawData];
      // 应用默认值
      Object.keys(defaults).forEach((field) => {
        records.forEach((r) => {
          if (!r[field] || String(r[field]).trim() === '') {
            r[field] = defaults[field];
          }
        });
      });
    }

    res.json({ code: 200, data: records, headers: ext === '.json' ? null : (rawData[0] || []), message: `解析成功，共 ${records.length} 条` });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(500).json({ code: 500, message: `解析失败: ${err.message}` });
  }
});

// CSV 解析（处理引号包裹的字段）
function parseCSV(content) {
  const lines = content.split('\n').filter((l) => l.trim());
  return lines.map((line) => {
    const fields = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    return fields;
  });
}

module.exports = router;
