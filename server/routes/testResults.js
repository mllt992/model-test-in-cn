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

// ========== 测试结果列表 ==========
router.get('/', (req, res) => {
  const {
    keyword,
    test_type,
    response_type,
    is_refused,
    match_result,
    human_audit,
    ai_config_id,
    ai_model,
    risk_type,
    risk_category,
    page = 1,
    pageSize = 10,
  } = req.query;

  const offset = (page - 1) * pageSize;
  const conditions = [];
  const params = [];

  if (keyword) {
    conditions.push('(t.question LIKE ? OR t.generated_content LIKE ? OR t.remark LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  if (test_type) {
    conditions.push('t.test_type = ?');
    params.push(test_type);
  }
  if (response_type) {
    conditions.push('t.response_type = ?');
    params.push(response_type);
  }
  if (is_refused !== undefined && is_refused !== '') {
    conditions.push('t.is_refused = ?');
    params.push(Number(is_refused));
  }
  if (match_result) {
    if (match_result === '匹配') {
      conditions.push('((t.is_refused = 1 AND t.response_type = "合理拒答") OR (t.is_refused = 0 AND t.response_type = "合理回答"))');
    } else if (match_result === '不匹配') {
      conditions.push('NOT ((t.is_refused = 1 AND t.response_type = "合理拒答") OR (t.is_refused = 0 AND t.response_type = "合理回答"))');
    }
  }
  if (human_audit) {
    conditions.push('t.human_audit = ?');
    params.push(human_audit);
  }
  if (ai_config_id) {
    conditions.push('t.ai_config_id = ?');
    params.push(Number(ai_config_id));
  }
  if (ai_model) {
    conditions.push('t.ai_model LIKE ?');
    params.push(`%${ai_model}%`);
  }
  if (risk_type) {
    conditions.push('t.risk_type = ?');
    params.push(risk_type);
  }
  if (risk_category) {
    conditions.push('t.risk_category = ?');
    params.push(risk_category);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT t.*, u.nickname as tester_name
    FROM test_results t
    LEFT JOIN users u ON t.tester_id = u.id
    ${where} ORDER BY t.id DESC LIMIT ? OFFSET ?
  `;

  const list = db.prepare(sql).all(...params, Number(pageSize), Number(offset));

  const totalParams = [...params];
  const totalResult = db.prepare(
    `SELECT COUNT(*) as total FROM test_results t ${where}`
  ).get(...totalParams);

  // 统计信息（包含匹配率计算）
  // 匹配规则：is_refused=1 且 response_type='合理拒答' → 匹配
  //          is_refused=0 且 response_type='合理回答' → 匹配
  //          其他 → 不匹配
  const statsResult = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN t.response_type = '合理回答' THEN 1 ELSE 0 END) as normal_count,
      SUM(CASE WHEN t.response_type = '合理拒答' THEN 1 ELSE 0 END) as refused_count,
      SUM(CASE WHEN t.response_type = '异常回复' THEN 1 ELSE 0 END) as error_count,
      SUM(CASE WHEN t.human_audit = '合格' THEN 1 ELSE 0 END) as pass_count,
      SUM(CASE WHEN t.human_audit = '不合格' THEN 1 ELSE 0 END) as fail_count,
      SUM(CASE WHEN (t.is_refused = 1 AND t.response_type = '合理拒答') OR (t.is_refused = 0 AND t.response_type = '合理回答') THEN 1 ELSE 0 END) as match_count
    FROM test_results t ${where}
  `).get(...totalParams);

  const resultList = list.map((item, index) => ({
    ...item,
    index: offset + index + 1,
  }));

  // 计算匹配率
  const matchRate = statsResult.total > 0
    ? ((statsResult.match_count || 0) / statsResult.total * 100).toFixed(1) + '%'
    : '0%';

  res.json({
    code: 200,
    data: {
      list: resultList,
      total: totalResult.total,
      page: Number(page),
      pageSize: Number(pageSize),
      stats: {
        total: statsResult.total || 0,
        normal_count: statsResult.normal_count || 0,
        refused_count: statsResult.refused_count || 0,
        error_count: statsResult.error_count || 0,
        pass_count: statsResult.pass_count || 0,
        fail_count: statsResult.fail_count || 0,
        match_count: statsResult.match_count || 0,
        match_rate: matchRate,
      },
    },
  });
});

// ========== 获取测试类型列表 ==========
router.get('/test-types', (req, res) => {
  const rows = db.prepare("SELECT DISTINCT test_type FROM test_results WHERE test_type IS NOT NULL AND test_type != '' ORDER BY test_type").all();
  res.json({ code: 200, data: rows.map(r => r.test_type) });
});

// ========== 获取回答类型列表 ==========
router.get('/response-types', (req, res) => {
  const rows = db.prepare("SELECT DISTINCT response_type FROM test_results WHERE response_type IS NOT NULL AND response_type != '' ORDER BY response_type").all();
  res.json({ code: 200, data: rows.map(r => r.response_type) });
});

// ========== 获取安全风险项列表 ==========
router.get('/risk-types', (req, res) => {
  const rows = db.prepare("SELECT DISTINCT risk_type FROM test_results WHERE risk_type IS NOT NULL AND risk_type != '' ORDER BY risk_type").all();
  res.json({ code: 200, data: rows.map(r => r.risk_type) });
});

// ========== 获取风险类别列表 ==========
router.get('/risk-categories', (req, res) => {
  const rows = db.prepare("SELECT DISTINCT risk_category FROM test_results WHERE risk_category IS NOT NULL AND risk_category != '' ORDER BY risk_category").all();
  res.json({ code: 200, data: rows.map(r => r.risk_category) });
});

// ========== 获取已存在的题目ID列表 ==========
router.get('/existing-question-ids', (req, res) => {
  const rows = db.prepare('SELECT question FROM test_results').all();
  res.json({ code: 200, data: rows.map(r => r.question) });
});

// ========== 创建测试结果 ==========
router.post('/', (req, res) => {
  const {
    test_type = '文本生成',
    question,
    risk_type = '',
    risk_category = '',
    generated_content = '',
    response_type = '',
    human_audit = '',
    remark = '',
    ai_config_id = null,
    ai_config_name = '',
    ai_model = '',
    tester_id = null,
  } = req.body;

  if (!question) {
    return res.status(400).json({ code: 400, message: '题目不能为空' });
  }

  const result = db.prepare(`
    INSERT INTO test_results (test_type, question, risk_type, risk_category, generated_content, response_type, human_audit, remark, ai_config_id, ai_config_name, ai_model, tester_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(test_type, question, risk_type, risk_category, generated_content, response_type, human_audit, remark, ai_config_id, ai_config_name, ai_model, tester_id);

  res.json({ code: 200, message: '新增成功', data: { id: result.lastInsertRowid } });
});

// ========== 批量创建测试结果 ==========
router.post('/batch', (req, res) => {
  const { items, ai_config_id = null, ai_config_name = '', ai_model = '', tester_id = null, test_type = '文本生成' } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ code: 400, message: '导入数据不能为空' });
  }

  const insert = db.prepare(`
    INSERT INTO test_results (test_type, question, risk_type, risk_category, generated_content, response_type, human_audit, remark, ai_config_id, ai_config_name, ai_model, tester_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((records) => {
    let count = 0;
    for (const item of records) {
      insert.run(
        test_type || item.test_type || '文本生成',
        item.question || '',
        item.risk_type || item.type || '',
        item.risk_category || item.category || '',
        item.generated_content || item.model_answer || '',
        item.response_type || '',
        item.human_audit || '',
        item.remark || '',
        ai_config_id,
        ai_config_name,
        ai_model,
        tester_id
      );
      count++;
    }
    return count;
  });

  const count = insertMany(items);
  res.json({ code: 200, message: `成功导入 ${count} 条记录` });
});

// ========== 更新测试结果 ==========
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { test_type, question, risk_type, risk_category, generated_content, response_type, human_audit, remark } = req.body;

  const existing = db.prepare('SELECT id FROM test_results WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ code: 404, message: '记录不存在' });
  }

  const updates = [];
  const params = [];
  if (test_type !== undefined) { updates.push('test_type = ?'); params.push(test_type); }
  if (question !== undefined) { updates.push('question = ?'); params.push(question); }
  if (risk_type !== undefined) { updates.push('risk_type = ?'); params.push(risk_type); }
  if (risk_category !== undefined) { updates.push('risk_category = ?'); params.push(risk_category); }
  if (generated_content !== undefined) { updates.push('generated_content = ?'); params.push(generated_content); }
  if (response_type !== undefined) { updates.push('response_type = ?'); params.push(response_type); }
  if (human_audit !== undefined) { updates.push('human_audit = ?'); params.push(human_audit); }
  if (remark !== undefined) { updates.push('remark = ?'); params.push(remark); }
  updates.push('updated_at = CURRENT_TIMESTAMP');

  params.push(id);
  db.prepare(`UPDATE test_results SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  res.json({ code: 200, message: '更新成功' });
});

// ========== 删除测试结果 ==========
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM test_results WHERE id = ?').run(id);
  res.json({ code: 200, message: '删除成功' });
});

// ========== 批量删除 ==========
router.post('/batch-delete', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ code: 400, message: '请选择要删除的记录' });
  }

  const deleteStmt = db.prepare('DELETE FROM test_results WHERE id = ?');
  const deleteMany = db.transaction((idList) => {
    for (const id of idList) deleteStmt.run(id);
  });
  deleteMany(ids);

  res.json({ code: 200, message: `成功删除 ${ids.length} 条记录` });
});

// ========== 删除全部 ==========
router.post('/delete-all', (req, res) => {
  const result = db.prepare('DELETE FROM test_results').run();
  res.json({ code: 200, message: `成功删除全部 ${result.changes} 条记录` });
});

// ========== 执行单题AI测试 ==========
router.post('/run-test', async (req, res) => {
  const { id, ai_config_id } = req.body;
  console.log('[run-test] id:', id, 'ai_config_id:', ai_config_id);

  const row = db.prepare('SELECT * FROM test_results WHERE id = ?').get(id);
  if (!row) {
    return res.status(404).json({ code: 404, message: '记录不存在' });
  }

  // 获取AI配置：优先使用指定的渠道，否则使用激活的渠道
  let aiConfig = null;
  if (ai_config_id) {
    aiConfig = db.prepare('SELECT * FROM ai_config WHERE id = ?').get(ai_config_id);
    console.log('[run-test] 使用指定渠道:', aiConfig ? aiConfig.name : '未找到');
  }
  if (!aiConfig) {
    aiConfig = db.prepare('SELECT * FROM ai_config WHERE is_active = 1 LIMIT 1').get();
    console.log('[run-test] 使用激活渠道:', aiConfig ? aiConfig.name : '未找到');
  }
  if (!aiConfig || !aiConfig.api_base_url || !aiConfig.api_key) {
    return res.status(400).json({ code: 400, message: '请先选择或配置AI渠道' });
  }

  // 构建提示词 - 直接发送问题，不添加额外的生成指令
  let prompt = row.question;

  console.log('[run-test] prompt:', prompt.substring(0, 100));

  const baseUrl = aiConfig.api_base_url.replace(/\/+$/, '');

  try {
    let aiAnswer = '';

    if (aiConfig.protocol === 'gemini') {
      console.log('[run-test] 调用 Gemini API');
      const resp = await fetch(`${baseUrl}/models/${aiConfig.model}:generateContent?key=${aiConfig.api_key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        signal: AbortSignal.timeout(60000),
      });
      const data = await resp.json();
      console.log('[run-test] Gemini 响应:', JSON.stringify(data).substring(0, 200));
      aiAnswer = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else if (aiConfig.protocol === 'claude') {
      console.log('[run-test] 调用 Claude API');
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
      console.log('[run-test] Claude 响应:', JSON.stringify(data).substring(0, 200));
      aiAnswer = data.content?.[0]?.text || '';
    } else {
      console.log('[run-test] 调用 OpenAI/API 协议, baseUrl:', baseUrl, 'model:', aiConfig.model);
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
      console.log('[run-test] OpenAI 响应状态:', resp.status, '内容:', JSON.stringify(data).substring(0, 200));
      aiAnswer = data.choices?.[0]?.message?.content || '';
    }

    // 自动判断回答类型
    const responseType = judgeResponseType(aiAnswer);
    console.log('[run-test] aiAnswer长度:', aiAnswer.length, 'responseType:', responseType);

    // 更新记录
    db.prepare(`
      UPDATE test_results
      SET generated_content = ?, response_type = ?, ai_config_id = ?, ai_config_name = ?, ai_model = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(aiAnswer, responseType, aiConfig.id, aiConfig.name, aiConfig.model, id);

    res.json({
      code: 200,
      message: '测试完成',
      data: { id, generated_content: aiAnswer, response_type: responseType },
    });
  } catch (err) {
    const responseType = judgeResponseType('');
    db.prepare(`
      UPDATE test_results
      SET generated_content = ?, response_type = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(`AI调用失败: ${err.message}`, responseType, id);

    res.status(500).json({ code: 500, message: 'AI调用失败: ' + err.message });
  }
});

// ========== 批量执行AI测试 ==========
router.post('/run-batch-test', async (req, res) => {
  const { ids, ai_config_id } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ code: 400, message: '请选择要测试的记录' });
  }

  // 获取AI配置：优先使用指定的渠道，否则使用激活的渠道
  let aiConfig = null;
  if (ai_config_id) {
    aiConfig = db.prepare('SELECT * FROM ai_config WHERE id = ?').get(ai_config_id);
  }
  if (!aiConfig) {
    aiConfig = db.prepare('SELECT * FROM ai_config WHERE is_active = 1 LIMIT 1').get();
  }
  if (!aiConfig || !aiConfig.api_base_url || !aiConfig.api_key) {
    return res.status(400).json({ code: 400, message: '请先选择或配置AI渠道' });
  }

  const results = [];
  const baseUrl = aiConfig.api_base_url.replace(/\/+$/, '');

  for (const id of ids) {
    const row = db.prepare('SELECT * FROM test_results WHERE id = ?').get(id);
    if (!row) {
      results.push({ id, success: false, message: '记录不存在' });
      continue;
    }

    // 构建提示词 - 直接发送问题，不添加额外的生成指令
    let prompt = row.question;

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

      const responseType = judgeResponseType(aiAnswer);

      db.prepare(`
        UPDATE test_results
        SET generated_content = ?, response_type = ?, ai_config_id = ?, ai_config_name = ?, ai_model = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(aiAnswer, responseType, aiConfig.id, aiConfig.name, aiConfig.model, id);

      results.push({ id, success: true, response_type: responseType });
    } catch (err) {
      const responseType = judgeResponseType('');
      db.prepare(`
        UPDATE test_results
        SET generated_content = ?, response_type = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(`AI调用失败: ${err.message}`, responseType, id);

      results.push({ id, success: false, message: err.message });
    }

    // 添加延迟避免API限流
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  const successCount = results.filter(r => r.success).length;
  res.json({
    code: 200,
    message: `完成 ${successCount}/${ids.length} 条`,
    data: results,
  });
});

const { judgeResponseType } = require('../utils/ai');

// ========== 导出测试结果 ==========
router.post('/export', (req, res) => {
  const { columns, format = 'xlsx', keyword, test_type, response_type, is_refused, match_result, human_audit, ai_config_id, ai_model, risk_type, risk_category } = req.body;

  if (!columns || !Array.isArray(columns) || columns.length === 0) {
    return res.status(400).json({ code: 400, message: '导出列不能为空' });
  }

  const conditions = [];
  const params = [];
  if (keyword) {
    conditions.push('(t.question LIKE ? OR t.generated_content LIKE ? OR t.remark LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  if (test_type) {
    conditions.push('t.test_type = ?');
    params.push(test_type);
  }
  if (response_type) {
    conditions.push('t.response_type = ?');
    params.push(response_type);
  }
  if (is_refused !== undefined && is_refused !== '') {
    conditions.push('t.is_refused = ?');
    params.push(Number(is_refused));
  }
  if (match_result) {
    if (match_result === '匹配') {
      conditions.push('((t.is_refused = 1 AND t.response_type = "合理拒答") OR (t.is_refused = 0 AND t.response_type = "合理回答"))');
    } else if (match_result === '不匹配') {
      conditions.push('NOT ((t.is_refused = 1 AND t.response_type = "合理拒答") OR (t.is_refused = 0 AND t.response_type = "合理回答"))');
    }
  }
  if (human_audit) {
    conditions.push('t.human_audit = ?');
    params.push(human_audit);
  }
  if (ai_config_id) {
    conditions.push('t.ai_config_id = ?');
    params.push(Number(ai_config_id));
  }
  if (ai_model) {
    conditions.push('t.ai_model LIKE ?');
    params.push(`%${ai_model}%`);
  }
  if (risk_type) {
    conditions.push('t.risk_type = ?');
    params.push(risk_type);
  }
  if (risk_category) {
    conditions.push('t.risk_category = ?');
    params.push(risk_category);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const data = db.prepare(`
    SELECT t.*, u.nickname as tester_name
    FROM test_results t
    LEFT JOIN users u ON t.tester_id = u.id
    ${where} ORDER BY t.id DESC
  `).all(...params);

  // 列名映射
  const fieldMap = {
    index: 'index', test_type: 'test_type', question: 'question', risk_type: 'risk_type',
    risk_category: 'risk_category', generated_content: 'generated_content',
    response_type: 'response_type', human_audit: 'human_audit', remark: 'remark',
    ai_config_name: 'ai_config_name', ai_model: 'ai_model', tester_name: 'tester_name',
    created_at: 'created_at', updated_at: 'updated_at',
  };

  const exportData = data.map((item, idx) => {
    const row = {};
    columns.forEach((col) => {
      const field = fieldMap[col.key];
      if (field === 'index') {
        row[col.label] = idx + 1;
      } else {
        row[col.label] = item[field] ?? '';
      }
    });
    return row;
  });

  if (format === 'xlsx') {
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '测试结果');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=test_results.xlsx');
    return res.send(buf);
  }

  if (format === 'csv') {
    const ws = XLSX.utils.json_to_sheet(exportData);
    const csv = XLSX.utils.sheet_to_csv(ws, { FS: ',' });
    res.setHeader('Content-Type', 'text/csv;charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=test_results.csv');
    return res.send('\ufeff' + csv);
  }

  res.json({ code: 200, data: exportData });
});

// ========== 从题库导入测试题 ==========
router.post('/import-from-questions', (req, res) => {
  const { question_ids, ai_config_id = null, ai_config_name = '', ai_model = '', tester_id = null, test_type = '文本生成' } = req.body;

  let questions;
  if (question_ids && question_ids.length > 0) {
    const placeholders = question_ids.map(() => '?').join(',');
    questions = db.prepare(`SELECT * FROM questions WHERE id IN (${placeholders})`).all(...question_ids);
  } else {
    questions = db.prepare('SELECT * FROM questions ORDER BY id DESC LIMIT 100').all();
  }

  if (questions.length === 0) {
    return res.status(400).json({ code: 400, message: '没有可导入的题目' });
  }

  // 获取已存在的题目（根据question字段去重）
  const existingQuestions = db.prepare('SELECT question FROM test_results').all();
  const existingSet = new Set(existingQuestions.map(r => r.question));

  // 过滤掉已存在的题目
  const newQuestions = questions.filter(q => !existingSet.has(q.question));
  const skipCount = questions.length - newQuestions.length;

  if (newQuestions.length === 0) {
    return res.status(400).json({ code: 400, message: `所有 ${skipCount} 条题目已存在，无需重复导入` });
  }

  const insert = db.prepare(`
    INSERT INTO test_results (test_type, question, risk_type, risk_category, is_refused, ai_config_id, ai_config_name, ai_model, tester_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const importMany = db.transaction((items) => {
    let count = 0;
    for (const item of items) {
      insert.run(
        test_type,
        item.question,
        item.type || '',
        item.category || '',
        item.is_refused !== undefined ? Number(item.is_refused) : -1,
        ai_config_id,
        ai_config_name,
        ai_model,
        tester_id
      );
      count++;
    }
    return count;
  });

  const count = importMany(newQuestions);
  const message = skipCount > 0
    ? `成功导入 ${count} 条测试题（跳过 ${skipCount} 条已存在的题目）`
    : `成功导入 ${count} 条测试题`;

  res.json({ code: 200, message });
});

// ========== 文件上传配置 ==========
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).substring(2)}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// 导入预览
router.post('/import/preview', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ code: 400, message: '请上传文件' });

  const ext = path.extname(req.file.originalname).toLowerCase();

  try {
    let sheets = [];

    if (ext === '.xlsx' || ext === '.xls') {
      const workbook = XLSX.readFile(req.file.path, { cellDates: true });
      workbook.SheetNames.forEach((name) => {
        const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: '' });
        const headers = rawData.length > 0 ? rawData[0].map(h => String(h).trim()) : [];
        const preview = rawData.slice(1, 6).map(row =>
          headers.map((_, i) => row[i] ?? '')
        );
        sheets.push({ name, headers, preview, totalRows: Math.max(rawData.length - 1, 0) });
      });
    } else if (ext === '.csv') {
      const content = fs.readFileSync(req.file.path, 'utf-8');
      const rawData = parseCSV(content);
      const headers = rawData.length > 0 ? rawData[0].map(h => String(h).trim()) : [];
      const preview = rawData.slice(1, 6).map(row =>
        headers.map((_, i) => row[i] ?? '')
      );
      sheets.push({ name: 'CSV', headers, preview, totalRows: Math.max(rawData.length - 1, 0) });
    } else if (ext === '.json') {
      const content = fs.readFileSync(req.file.path, 'utf-8');
      const rawData = JSON.parse(content);
      const arr = Array.isArray(rawData) ? rawData : [rawData];
      const headers = arr.length > 0 ? Object.keys(arr[0]) : [];
      const preview = arr.slice(0, 5).map(row =>
        headers.map(h => row[h] ?? '')
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

// CSV解析
function parseCSV(content) {
  const lines = content.split('\n').filter(l => l.trim());
  return lines.map(line => {
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
