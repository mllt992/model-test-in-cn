const express = require('express');
const db = require('../database/init');

const router = express.Router();

// 调用AI生成题目
router.post('/generate', async (req, res) => {
  const { count = 1, type = '', category = '', is_refused = null, skills = [], prompt = '', ai_config_id } = req.body;

  // 获取AI配置
  let config;
  if (ai_config_id) {
    config = db.prepare('SELECT * FROM ai_config WHERE id = ?').get(ai_config_id);
  }
  if (!config) {
    config = db.prepare('SELECT * FROM ai_config WHERE is_active = 1 LIMIT 1').get();
  }
  if (!config) {
    return res.status(400).json({ code: 400, message: '请先配置并激活AI' });
  }

  // 获取启用的skills
  let skillContent = '';
  if (skills && skills.length > 0) {
    const skillRows = db.prepare(`SELECT * FROM ai_skills WHERE id IN (${skills.map(() => '?').join(',')}) AND enabled = 1`).all(skills);
    skillContent = skillRows.map(s => s.content).join('\n\n');
  }

  // 构建prompt
  let systemPrompt = config.agent_prompt || '你是一个专业的AI模型测试题生成助手。';
  if (skillContent) {
    systemPrompt += '\n\n【技能】\n' + skillContent;
  }

  let userPrompt = prompt || '请生成一道测试题';
  userPrompt += `\n\n生成${count}道题目。`;
  if (type) userPrompt += `\n类型：${type}`;
  if (category) userPrompt += `\n类别：${category}`;

  const results = [];

  for (let i = 0; i < count; i++) {
    try {
      const messages = [
        { role: 'system', content: systemPrompt + '\n\n' + (config.rules || '') },
        { role: 'user', content: userPrompt }
      ];

      const body = {
        model: config.model,
        messages,
        temperature: 0.8,
        max_tokens: 2000
      };

      const baseUrl = config.api_base_url.replace(/\/+$/, '');
      let apiUrl = `${baseUrl}/chat/completions`;

      if (config.protocol === 'claude') {
        apiUrl = `${baseUrl}/messages`;
        body.model = config.model;
        delete body.messages;
        body.messages = messages;
      } else if (config.protocol === 'gemini') {
        apiUrl = `${baseUrl}/v1beta/models/${config.model}:generateContent`;
        body.contents = messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
        delete body.messages;
      }

      const headers = { 'Content-Type': 'application/json' };
      if (config.protocol === 'claude') {
        headers['anthropic-version'] = '2023-06-01';
        headers['x-api-key'] = config.api_key;
      } else if (config.protocol === 'gemini') {
        headers['x-goog-api-key'] = config.api_key;
      } else {
        headers['Authorization'] = `Bearer ${config.api_key}`;
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60000)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API错误 ${response.status}: ${errText.substring(0, 200)}`);
      }

      const rawText = await response.text();
      const data = JSON.parse(rawText);
      let content = '';

      if (config.protocol === 'gemini') {
        content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } else if (config.protocol === 'claude') {
        content = data.content?.[0]?.text || '';
      } else {
        content = data.choices?.[0]?.message?.content || '';
      }

      // 解析生成结果
      const parsed = parseGeneratedContent(content, type, category, is_refused);
      results.push(parsed);
    } catch (err) {
      results.push({
        question: `生成失败: ${err.message}`,
        answer: '',
        is_refused: 0,
        type,
        category
      });
    }
  }

  res.json({ code: 200, data: results, message: `成功生成${results.length}条` });
});

// 解析AI返回的内容
function parseGeneratedContent(content, type, category, is_refused) {
  // 尝试从JSON中解析
  let jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  if (!jsonMatch) {
    jsonMatch = content.match(/\{[\s\S]*\}/);
  }

  if (jsonMatch) {
    try {
      const json = JSON.parse(jsonMatch[0]);
      return {
        question: json.question || json.title || json.content || content,
        answer: json.answer || json.response || json.model_answer || '',
        is_refused: (is_refused !== null && is_refused !== undefined) ? is_refused : (json.is_refused || 0),
        type: type || json.type || '',
        category: category || json.category || ''
      };
    } catch (e) {}
  }

  // 尝试解析markdown格式
  let question = '';
  let answer = '';
  let refused = is_refused !== null && is_refused !== undefined ? is_refused : 0;

  // 提取题目
  const questionMatch = content.match(/(?:题目|问|问题|题目[^：]*)[:：]\s*([\s\S]*?)(?=\n(?:回答|答|答案|答案[^：]*)[:：]|$)/i);
  if (questionMatch) {
    question = questionMatch[1].trim();
  } else {
    const qMatch = content.match(/\*\*题目[:：]\*\*\s*([\s\S]*?)(?=\*\*回答)/);
    if (qMatch) {
      question = qMatch[1].trim();
    }
  }

  // 提取回答
  const answerMatch = content.match(/(?:回答|答|答案)[:：]\s*([\s\S]*?)$/i);
  if (answerMatch) {
    answer = answerMatch[1].trim();
  }

  // 检查是否拒答
  if (content.includes('拒答') || content.includes('拒绝') || content.includes('无法回答')) {
    refused = 1;
  }

  // 如果还是解析不出来，用原始内容
  if (!question && !answer) {
    // 尝试按行分割
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length >= 2) {
      question = lines[0].replace(/^#+\s*/, '').replace(/^\d+[.、]\s*/, '');
      answer = lines.slice(1).join('\n').replace(/^#+\s*/, '');
    } else {
      question = content.substring(0, 500);
      answer = '';
    }
  }

  return {
    question,
    answer,
    is_refused: refused,
    type,
    category
  };
}

// 重复检测
router.post('/check-duplicate', (req, res) => {
  const { questions } = req.body;
  if (!questions || !Array.isArray(questions)) {
    return res.status(400).json({ code: 400, message: '缺少questions参数' });
  }

  const duplicates = [];
  const normalized = questions.map(q => q.toLowerCase().trim());

  for (let i = 0; i < normalized.length; i++) {
    for (let j = i + 1; j < normalized.length; j++) {
      if (normalized[i] === normalized[j]) {
        duplicates.push({ index1: i, index2: j, question: questions[i] });
      }
    }
  }

  res.json({ code: 200, data: duplicates });
});

// 保存生成的题目
router.post('/save', (req, res) => {
  const { items } = req.body;
  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ code: 400, message: '缺少items参数' });
  }

  const user = JSON.parse(req.headers['x-user'] || '{}');
  const userId = user.id || null;

  const insert = db.prepare(`
    INSERT INTO questions (question, category, model_answer, type, is_answered, is_refused, creator_id, updater_id)
    VALUES (?, ?, ?, ?, 1, ?, ?, ?)
  `);

  const results = [];
  const saveAll = db.transaction(() => {
    for (const item of items) {
      const result = insert.run(
        item.question || '',
        item.category || '',
        item.answer || '',
        item.type || '',
        item.is_refused || 0,
        userId,
        userId
      );
      results.push({ id: result.lastInsertRowid, question: item.question });
    }
  });

  saveAll();
  res.json({ code: 200, data: results, message: `成功保存${results.length}条` });
});

module.exports = router;