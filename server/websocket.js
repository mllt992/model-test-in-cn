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

  let userPrompt = prompt || '请生成一道测试题';
  userPrompt += `\n\n生成${count}道题目。`;
  if (type) userPrompt += `\n类型：${type}`;
  if (category) userPrompt += `\n类别：${category}`;

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

  // 尝试从JSON中解析
  let jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  if (!jsonMatch) {
    jsonMatch = content.match(/```\s*([\s\S]*?)\s*```/);
  }
  if (!jsonMatch) {
    jsonMatch = content.match(/^\s*\{[\s\S]*\}\s*$/m);
  }

  if (jsonMatch) {
    try {
      const json = JSON.parse(jsonMatch[0]);
      const question = json.question || json.title || json.content || json.Q || '';
      const answer = json.answer || json.response || json.model_answer || json.A || '';
      if (question) {
        // JSON 解析成功时，优先使用用户指定的 is_refused
        return {
          question,
          answer,
          is_refused: defaultRefused,
          type: type || json.type || '',
          category: category || json.category || ''
        };
      }
    } catch (e) {}
  }

  // 非 JSON 格式，按行解析
  const lines = content.split('\n').map(l => l.trim()).filter(l => l);
  let question = '';
  let answer = '';

  // 1. 找题目 - 优先匹配标题格式
  for (const line of lines) {
    // 跳过代码块标记
    if (line.startsWith('```')) continue;

    // 匹配 Markdown 标题
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      question = headingMatch[2];
      break;
    }

    // 匹配 "题目:" 或 "Q:" 格式
    const qMatch = line.match(/^(?:题目|Q[uestion]*?)[:：]\s*(.+)/i);
    if (qMatch) {
      question = qMatch[1];
      break;
    }

    // 匹配 "第X题" 格式
    const numMatch = line.match(/^第\s*\d+\s*[题道个]\s*(.+)/);
    if (numMatch) {
      question = numMatch[1];
      break;
    }
  }

  // 2. 找回答 - 在题目之后的内容中查找
  if (question) {
    const questionIndex = lines.findIndex(l =>
      l.includes(question) ||
      l.match(/^(?:题目|Q)[:：]\s*/i) ||
      l.match(/^#{1,6}\s+/)
    );

    if (questionIndex >= 0 && questionIndex < lines.length - 1) {
      // 取题目之后的行作为回答
      const answerCandidate = lines.slice(questionIndex + 1).join('\n');

      // 匹配回答标记
      const answerMatch = answerCandidate.match(/^(?:(?:回答|答|答案|A[nswer]*?|回复)[:：])\s*([\s\S]*)/im);
      if (answerMatch) {
        answer = answerMatch[1].trim();
      } else if (answerCandidate.trim()) {
        // 没有明确的回答标记时，检查是否是内容还是拒绝
        if (!answerCandidate.includes('拒答') && !answerCandidate.includes('无法回答')) {
          answer = answerCandidate.trim();
        }
      }
    }
  } else {
    // 没有找到题目时，用第一段内容
    question = lines[0] || content.substring(0, 500);
    if (lines.length > 1) {
      answer = lines.slice(1).join('\n');
    }
  }

  // 3. 只有当 AI 明确表示拒答时才设为拒答
  let refused = defaultRefused;
  // 检查整篇内容中是否有明确的拒答指示
  if (content.includes('**拒答**') || content.includes('「拒答」')) {
    refused = 1;
  }

  // 最终保底
  if (!question) {
    question = content.substring(0, 500);
  }

  return {
    question,
    answer,
    is_refused: refused,
    type,
    category
  };
}

module.exports = { initWebSocket };
