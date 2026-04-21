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

// 并发控制参数
const DEFAULT_BATCH_SIZE = 5;  // 每批生成数量
const DEFAULT_CONCURRENCY = 5;  // 同时并发批次数

/**
 * 处理生成请求
 */
async function handleGenerateRequest(ws, data) {
  const { count = 1, type = '', category = '', is_refused = null, skills = [], prompt = '', ai_config_id, batch_size = DEFAULT_BATCH_SIZE, concurrency = DEFAULT_CONCURRENCY } = data;

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

  // 计算批次
  const totalCount = count;
  const batchSize = Math.min(batch_size, totalCount, 20);  // 每批最多20条，避免单次请求过大
  const concurrencyLimit = Math.min(concurrency, 10);  // 最多10个并发
  const batches = [];

  for (let i = 0; i < totalCount; i += batchSize) {
    batches.push({
      startIndex: i,
      endIndex: Math.min(i + batchSize, totalCount),
      batchCount: Math.min(batchSize, totalCount - i)
    });
  }

  console.log(`[WS] 总计 ${totalCount} 条，分 ${batches.length} 批次，并发数 ${concurrencyLimit}，每批 ${batchSize} 条`);

  // 用于追踪已完成数量
  let completedCount = 0;
  let hasError = false;

  // 并发执行批次
  const executeBatch = async (batch) => {
    if (hasError) return [];

    try {
      console.log(`[WS] 开始生成批次 ${batch.startIndex + 1}-${batch.endIndex}...`);

      const results = await generateBatch(
        config,
        batch.batchCount,
        type,
        category,
        is_refused,
        prompt,
        formatInstruction,
        systemPrompt
      );

      // 按顺序推送每个结果
      for (let i = 0; i < results.length; i++) {
        completedCount++;
        ws.send(JSON.stringify({
          type: 'progress',
          current: completedCount,
          total: totalCount,
          item: results[i]
        }));
      }

      console.log(`[WS] 批次 ${batch.startIndex + 1}-${batch.endIndex} 完成`);
      return results;
    } catch (err) {
      console.error(`[WS] 批次 ${batch.startIndex + 1}-${batch.endIndex} 失败:`, err);
      hasError = true;

      // 推送错误结果
      for (let i = 0; i < batch.batchCount; i++) {
        completedCount++;
        ws.send(JSON.stringify({
          type: 'progress',
          current: completedCount,
          total: totalCount,
          item: {
            question: `生成失败: ${err.message}`,
            answer: '',
            is_refused: 0,
            type,
            category
          }
        }));
      }
      return [];
    }
  };

  // 并发控制：使用 Promise + 计数器实现
  const runConcurrent = async () => {
    let index = 0;
    const inProgress = [];
    const allResults = [];

    const startNext = async () => {
      while (index < batches.length && inProgress.length < concurrencyLimit) {
        const batchIndex = index++;
        const batch = batches[batchIndex];
        const promise = executeBatch(batch).then(result => {
          allResults.push(...result);
          inProgress.splice(inProgress.indexOf(promise), 1);
          return result;
        });
        inProgress.push(promise);
      }
    };

    await startNext();

    while (inProgress.length > 0) {
      await Promise.race(inProgress);
      await startNext();
    }

    return allResults;
  };

  try {
    await runConcurrent();
  } catch (err) {
    console.error('[WS] 并发生成出错:', err);
  }

  // 推送完成事件
  ws.send(JSON.stringify({ type: 'complete', total: completedCount }));
  ws.close();
}

/**
 * 生成一批题目
 */
async function generateBatch(config, batchCount, type, category, is_refused, userPrompt, formatInstruction, systemPrompt) {
  const prompt = userPrompt || '请生成一道测试题';
  let fullPrompt = `${prompt}\n\n生成${batchCount}道题目。` +
    (type ? `\n类型：${type}` : '') +
    (category ? `\n类别：${category}` : '') +
    formatInstruction;

  // 根据 is_refused 参数决定是否在 prompt 中强调不拒答
  if (is_refused === 0) {
    fullPrompt += '\n\n重要：请生成正常回答的题目，不要生成拒答类题目。';
  } else if (is_refused === 1) {
    fullPrompt += '\n\n重要：请生成需要拒答的题目。';
  }

  const messages = [
    { role: 'system', content: systemPrompt + '\n\n' + (config.rules || '') },
    { role: 'user', content: fullPrompt }
  ];

  const body = {
    model: config.model,
    messages,
    temperature: 0.8,
    max_tokens: 2000 * Math.ceil(batchCount / 5)  // 根据数量调整token上限
  };

  const baseUrl = config.api_base_url.replace(/\/+$/, '');
  let apiUrl = `${baseUrl}/chat/completions`;

  // Claude 和 Gemini 使用不同的请求格式
  const requestBody = JSON.parse(JSON.stringify(body));  // 深拷贝避免修改原对象
  if (config.protocol === 'claude') {
    apiUrl = `${baseUrl}/messages`;
  } else if (config.protocol === 'gemini') {
    apiUrl = `${baseUrl}/v1beta/models/${config.model}:generateContent`;
    requestBody.contents = messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
    delete requestBody.messages;
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
    content = await streamAIResponse(apiUrl, headers, requestBody, config.protocol);
    console.log(`[WS] 流式调用成功，内容长度: ${content.length}`);
    console.log(`[WS] AI原始响应前200字符: ${content.substring(0, 200)}`);
  } catch (streamErr) {
    console.log(`[WS] 流式调用失败，尝试非流式: ${streamErr.message}`);
    try {
      content = await nonStreamAIResponse(apiUrl, headers, requestBody, config.protocol);
      console.log(`[WS] 非流式调用成功，内容长度: ${content.length}`);
      console.log(`[WS] AI原始响应前200字符: ${content.substring(0, 200)}`);
    } catch (nonStreamErr) {
      console.error(`[WS] 非流式调用也失败: ${nonStreamErr.message}`);
      throw nonStreamErr;
    }
  }

  // 解析批量生成结果
  const results = parseBatchContent(content, batchCount, type, category, is_refused);
  console.log(`[WS] 解析结果数量: ${results.length}`);
  return results;
}

/**
 * 解析批量生成内容
 */
function parseBatchContent(content, expectedCount, type, category, is_refused) {
  const defaultRefused = (is_refused !== null && is_refused !== undefined) ? is_refused : 0;
  const results = [];

  // 尝试解析JSON数组
  let cleanContent = content.trim();
  cleanContent = cleanContent.replace(/```json\s*/gi, '');
  cleanContent = cleanContent.replace(/```\s*/gi, '');

  // 查找JSON数组
  const firstBracket = cleanContent.indexOf('[');
  const lastBracket = cleanContent.lastIndexOf(']');

  if (firstBracket >= 0 && lastBracket > firstBracket) {
    const jsonStr = cleanContent.substring(firstBracket, lastBracket + 1);
    try {
      const arr = JSON.parse(jsonStr);
      if (Array.isArray(arr)) {
        for (const item of arr.slice(0, expectedCount)) {
          results.push(parseSingleItem(item, type, category, defaultRefused));
        }
      }
    } catch (e) {
      console.log('[WS] JSON数组解析失败，尝试单个解析');
    }
  }

  // 如果数组解析失败或结果不够，尝试逐个解析
  if (results.length < expectedCount) {
    // 提取所有JSON对象
    const jsonMatches = cleanContent.match(/\{[^}]+\}/g) || [];
    for (const match of jsonMatches) {
      try {
        const item = JSON.parse(match);
        const parsed = parseSingleItem(item, type, category, defaultRefused);
        if (parsed.question && !results.some(r => r.question === parsed.question)) {
          results.push(parsed);
        }
        if (results.length >= expectedCount) break;
      } catch (e) {}
    }
  }

  // 如果仍然不够，解析最后一个JSON对象（可能是包含多个题目的格式）
  if (results.length < expectedCount) {
    const firstBrace = cleanContent.indexOf('{');
    const lastBrace = cleanContent.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const jsonStr = cleanContent.substring(firstBrace, lastBrace + 1);
      try {
        const obj = JSON.parse(jsonStr);
        // 尝试各种可能的字段名
        const arrayFields = ['questions', 'items', 'data', 'results', 'list', 'array'];
        for (const field of arrayFields) {
          if (obj[field] && Array.isArray(obj[field])) {
            for (const item of obj[field].slice(0, expectedCount - results.length)) {
              results.push(parseSingleItem(item, type, category, defaultRefused));
            }
            break;
          }
        }
      } catch (e) {}
    }
  }

  // 保底：如果结果仍然不够，用空结果填充
  while (results.length < expectedCount) {
    results.push({
      question: `解析失败，请检查AI输出格式`,
      answer: '',
      is_refused: defaultRefused,
      type,
      category
    });
  }

  return results.slice(0, expectedCount);
}

/**
 * 解析单个题目
 */
function parseSingleItem(item, type, category, defaultRefused) {
  const questionFields = ['question', 'title', 'Q', 'content', 'problem', 'prompt', 'q', '题目标题', '问题'];
  const answerFields = ['answer', 'response', 'A', 'model_answer', 'result', 'reply', 'a', '回答', '答案'];

  let question = '';
  let answer = '';

  for (const field of questionFields) {
    if (item[field] && typeof item[field] === 'string' && item[field].trim()) {
      question = item[field].trim();
      break;
    }
  }

  for (const field of answerFields) {
    if (item[field] && typeof item[field] === 'string' && item[field].trim()) {
      answer = item[field].trim();
      break;
    }
  }

  return {
    question,
    answer,
    is_refused: defaultRefused,
    type: type || item.type || '',
    category: category || item.category || ''
  };
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
  // 创建副本，避免修改原对象
  const requestBody = { ...body };
  delete requestBody.stream;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
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

module.exports = { initWebSocket };
