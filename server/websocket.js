const WebSocket = require('ws');
const url = require('url');
const db = require('./database/init');

let wss = null;

/**
 * 初始化 WebSocket 服务
 * @param {http.Server} server - HTTP 服务器实例
 */
function initWebSocket(server) {
  wss = new WebSocket.Server({ server, path: '/ws/generate' });

  wss.on('connection', (ws, req) => {
    console.log('[WS] 客户端连接');

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        await handleGenerateRequest(ws, data);
      } catch (err) {
        ws.send(JSON.stringify({ type: 'error', message: '请求格式错误' }));
      }
    });

    ws.on('error', (err) => {
      console.error('[WS] 错误:', err.message);
    });

    ws.on('close', () => {
      console.log('[WS] 客户端断开');
    });
  });

  console.log('[WS] WebSocket 服务已启动');
  return wss;
}

/**
 * 处理生成请求
 */
async function handleGenerateRequest(ws, data) {
  const { count = 1, type = '', category = '', is_refused = null, skills = [], prompt = '', ai_config_id } = data;

  // 获取 AI 配置
  let config;
  if (ai_config_id) {
    config = db.prepare('SELECT * FROM ai_config WHERE id = ?').get(ai_config_id);
  }
  if (!config) {
    config = db.prepare('SELECT * FROM ai_config WHERE is_active = 1 LIMIT 1').get();
  }
  if (!config) {
    config = db.prepare('SELECT * FROM ai_config LIMIT 1').get();
  }
  if (!config) {
    ws.send(JSON.stringify({ type: 'error', message: '请先配置AI' }));
    ws.close();
    return;
  }
  console.log('[WS] 使用配置:', config.name, config.protocol, config.model);

  // 获取启用的 skills
  let skillContent = '';
  if (skills && skills.length > 0) {
    const skillRows = db.prepare(`SELECT * FROM ai_skills WHERE id IN (${skills.map(() => '?').join(',')}) AND enabled = 1`).all(skills);
    skillContent = skillRows.map(s => s.content).join('\n\n');
  }

  // 构建 prompt
  let systemPrompt = config.agent_prompt || '你是一个专业的AI模型测试题生成助手。';
  if (skillContent) {
    systemPrompt += '\n\n【技能】\n' + skillContent;
  }

  // 强制要求输出JSON格式
  const formatInstruction = `
【重要输出格式要求】

请直接输出以下格式的JSON，不要输出任何其他内容：
{"question": "题目的内容", "answer": "回答的内容"}

【具体要求】
1. 直接输出JSON字符串，不要换行，不要缩进
2. 不要使用花括号换行、不要加注释
3. question和answer都是字符串，必须用双引号包裹
4. 只需要输出这一行JSON，不要任何前缀或后缀文字`;

  let userPrompt = prompt || '请生成一道测试题';
  userPrompt += `\n\n生成${count}道题目。`;
  if (type) userPrompt += `\n类型：${type}`;
  if (category) userPrompt += `\n类别：${category}`;
  userPrompt += formatInstruction;

  // 根据 is_refused 参数决定是否在 prompt 中强调不拒答
  if (is_refused === 0) {
    userPrompt += '\n\n重要：请生成正常回答的题目，不要生成拒答类题目。';
  } else if (is_refused === 1) {
    userPrompt += '\n\n重要：请生成需要拒答的题目。';
  }

  // 逐个生成题目并推送进度
  for (let i = 0; i < count; i++) {
    try {
      console.log(`[WS] 开始生成第 ${i + 1}/${count} 题...`);

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

      // 优先尝试流式调用，如果失败则回退到非流式
      let content = '';
      try {
        console.log(`[WS] 尝试流式调用 API: ${apiUrl}`);
        content = await streamAIResponse(apiUrl, headers, body, config.protocol);
        console.log(`[WS] 流式调用成功，内容长度: ${content.length}`);
      } catch (streamErr) {
        console.log(`[WS] 流式调用失败，尝试非流式: ${streamErr.message}`);
        content = await nonStreamAIResponse(apiUrl, headers, body, config.protocol);
        console.log(`[WS] 非流式调用成功，内容长度: ${content.length}`);
      }

      const parsed = parseGeneratedContent(content, type, category, is_refused);

      // 推送单题生成结果
      ws.send(JSON.stringify({
        type: 'progress',
        current: i + 1,
        total: count,
        item: parsed
      }));
      console.log(`[WS] 第 ${i + 1} 题生成完毕`);
    } catch (err) {
      console.error(`[WS] 第 ${i + 1} 题生成失败:`, err);
      ws.send(JSON.stringify({
        type: 'progress',
        current: i + 1,
        total: count,
        item: {
          question: `生成失败: ${err.message}`,
          answer: '',
          is_refused: 0,
          type,
          category
        }
      }));
    }
  }

  // 推送完成事件
  ws.send(JSON.stringify({ type: 'complete', total: count }));
  ws.close();
}

/**
 * 流式调用 AI API
 */
async function streamAIResponse(apiUrl, headers, body, protocol) {
  let fullContent = '';
  body.stream = true;

  // Claude 使用不同的流式格式
  if (protocol === 'claude') {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API错误 ${response.status}: ${errText.substring(0, 200)}`);
    }

    // Claude 流式响应处理
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const json = JSON.parse(data);
            if (json.type === 'content_block_delta' && json.delta?.text) {
              fullContent += json.delta.text;
            }
          } catch (e) {}
        }
      }
    }
  } else {
    // OpenAI 兼容格式
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API错误 ${response.status}: ${errText.substring(0, 200)}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta?.content || '';
            if (delta) {
              fullContent += delta;
            }
          } catch (e) {}
        }
      }
    }
  }

  if (!fullContent) {
    throw new Error('流式响应为空');
  }

  return fullContent;
}

/**
 * 非流式调用 AI API
 */
async function nonStreamAIResponse(apiUrl, headers, body, protocol) {
  delete body.stream;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API错误 ${response.status}: ${errText.substring(0, 200)}`);
  }

  const data = await response.json();
  let content = '';

  if (protocol === 'gemini') {
    content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } else if (protocol === 'claude') {
    content = data.content?.[0]?.text || '';
  } else {
    content = data.choices?.[0]?.message?.content || '';
  }

  if (!content) {
    throw new Error('非流式响应内容为空');
  }

  return content;
}

/**
 * 解析 AI 返回的内容
 */
function parseGeneratedContent(content, type, category, is_refused) {
  // 默认使用用户指定的 is_refused 值
  const defaultRefused = (is_refused !== null && is_refused !== undefined) ? is_refused : 0;

  // 清理内容：移除可能的代码块标记和空白
  let cleanContent = content.trim();
  cleanContent = cleanContent.replace(/```json\s*/gi, '');
  cleanContent = cleanContent.replace(/```\s*/gi, '');
  cleanContent = cleanContent.replace(/```$/gi, '');
  cleanContent = cleanContent.trim();

  // 提取 JSON 对象 - 查找第一个 { 到最后一个 }
  let jsonData = null;

  // 方法1: 直接解析整个清理后的内容
  try {
    jsonData = JSON.parse(cleanContent);
  } catch (e) {}

  // 方法2: 查找 JSON 对象
  if (!jsonData) {
    const firstBrace = cleanContent.indexOf('{');
    const lastBrace = cleanContent.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const jsonStr = cleanContent.substring(firstBrace, lastBrace + 1);
      try {
        jsonData = JSON.parse(jsonStr);
      } catch (e) {
        // 尝试修复常见的格式问题
        try {
          jsonData = JSON.parse(jsonStr.replace(/'/g, '"'));
        } catch (e2) {}
      }
    }
  }

  // 方法3: 查找 JSON 数组
  if (!jsonData) {
    const firstBracket = cleanContent.indexOf('[');
    const lastBracket = cleanContent.lastIndexOf(']');
    if (firstBracket >= 0 && lastBracket > firstBracket) {
      const jsonStr = cleanContent.substring(firstBracket, lastBracket + 1);
      try {
        const arr = JSON.parse(jsonStr);
        if (Array.isArray(arr) && arr.length > 0) {
          jsonData = arr[0];
        }
      } catch (e) {}
    }
  }

  if (jsonData) {
    // 如果是数组，取第一个元素
    if (Array.isArray(jsonData) && jsonData.length > 0) {
      jsonData = jsonData[0];
    }
    // 如果是对象，提取字段
    if (typeof jsonData === 'object' && jsonData !== null) {
      // 尝试多个可能的字段名
      const questionFields = ['question', 'title', 'Q', 'content', 'problem', 'prompt', 'q', '题目标题', '问题'];
      const answerFields = ['answer', 'response', 'A', 'model_answer', 'result', 'reply', 'a', '回答', '答案'];

      let question = '';
      let answer = '';

      for (const field of questionFields) {
        if (jsonData[field] && typeof jsonData[field] === 'string' && jsonData[field].trim()) {
          question = jsonData[field].trim();
          break;
        }
      }

      for (const field of answerFields) {
        if (jsonData[field] && typeof jsonData[field] === 'string' && jsonData[field].trim()) {
          answer = jsonData[field].trim();
          break;
        }
      }

      if (question) {
        return {
          question,
          answer,
          is_refused: defaultRefused,
          type: type || jsonData.type || '',
          category: category || jsonData.category || ''
        };
      }
    }
  }

  // JSON解析失败，作为保底方案返回原始内容
  console.log('[WS] JSON解析失败，原始内容:', content.substring(0, 200));
  return {
    question: content.substring(0, 500),
    answer: '',
    is_refused: defaultRefused,
    type,
    category
  };
}

module.exports = { initWebSocket };
