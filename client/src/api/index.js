import request from '../utils/request';

export const authAPI = {
  login: (data) => request.post('/auth/login', data),
  me: () => request.get('/auth/me'),
};

export const blockwordsAPI = {
  list: (params) => request.get('/blockwords', { params }),
  create: (data) => request.post('/blockwords', data),
  update: (id, data) => request.put(`/blockwords/${id}`, data),
  delete: (id) => request.delete(`/blockwords/${id}`),
};

export const questionsAPI = {
  list: (params) => request.get('/questions', { params }),
  create: (data) => request.post('/questions', data),
  batchImport: (data) => request.post('/questions/batch', data),
  update: (id, data) => request.put(`/questions/${id}`, data),
  delete: (id) => request.delete(`/questions/${id}`),
  batchDelete: (data) => request.post('/questions/batch-delete', data),
  batchUpdateType: (data) => request.post('/questions/batch-update-type', data),
  batchUpdateCategory: (data) => request.post('/questions/batch-update-category', data),
  export: (data) => request.post('/questions/export', data, { responseType: 'blob' }),
  importFile: (formData) => request.post('/questions/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  importPreview: (formData) => request.post('/questions/import/preview', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  aiAnswer: (id) => request.post(`/questions/${id}/ai-answer`),
  batchAiAnswer: (ids) => request.post('/questions/batch-ai-answer', { ids }),

  /**
   * WebSocket批量重新回答（带实时进度）
   */
  runBatchReanswerWebSocket(ids, concurrency, onProgress, onComplete, onError) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/reanswer`;
    const ws = new WebSocket(wsUrl);

    const cleanup = () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };

    ws.onopen = () => {
      ws.send(JSON.stringify({ ids, concurrency }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'progress') {
          onProgress && onProgress(data);
        } else if (data.type === 'complete') {
          onComplete && onComplete(data);
          cleanup();
        } else if (data.type === 'error') {
          onError && onError(new Error(data.message));
          cleanup();
        }
      } catch (e) {
        onError && onError(e);
      }
    };

    ws.onerror = () => {
      onError && onError(new Error('WebSocket连接失败'));
    };

    return ws;
  },

  approve: (id, username) => request.post(`/questions/${id}/approve`, { username }),
  revokeApprove: (id, username) => request.post(`/questions/${id}/revoke-approve`, { username }),
  getDuplicates: () => request.get('/questions/duplicates'),
  removeDuplicates: (ids) => request.post('/questions/remove-duplicates', { ids }),
  getTypes: () => request.get('/questions/types'),
  getCategories: () => request.get('/questions/categories'),
};

export const statsAPI = {
  getAll: () => request.get('/stats/all'),
};

export const aiConfigAPI = {
  list: () => request.get('/ai-config'),
  getActive: () => request.get('/ai-config/active'),
  create: (data) => request.post('/ai-config', data),
  update: (id, data) => request.put(`/ai-config/${id}`, data),
  activate: (id) => request.put(`/ai-config/${id}/activate`),
  delete: (id) => request.delete(`/ai-config/${id}`),
  testConnection: (data) => request.post('/ai-config/test-connection', data),
  fetchModels: (data) => request.post('/ai-config/models', data),
  getSkills: () => request.get('/ai-config/skills'),
  createSkill: (data) => request.post('/ai-config/skills', data),
  updateSkill: (id, data) => request.put(`/ai-config/skills/${id}`, data),
  deleteSkill: (id) => request.delete(`/ai-config/skills/${id}`),
  getPrompts: () => request.get('/ai-config/prompts'),
  createPrompt: (data) => request.post('/ai-config/prompts', data),
  updatePrompt: (id, data) => request.put(`/ai-config/prompts/${id}`, data),
  deletePrompt: (id) => request.delete(`/ai-config/prompts/${id}`),
};

export const aiGenerateAPI = {
  generate: (data) => request.post('/ai-generate/generate', data),
  checkDuplicate: (data) => request.post('/ai-generate/check-duplicate', data),
  save: (data) => request.post('/ai-generate/save', data),
};

// 组织管理 API
export const organizationAPI = {
  list: (params) => request.get('/organizations', { params }),
  get: (id) => request.get(`/organizations/${id}`),
  create: (data) => request.post('/organizations', data),
  update: (id, data) => request.put(`/organizations/${id}`, data),
  delete: (id) => request.delete(`/organizations/${id}`),
  getAvailableUsers: () => request.get('/organizations/users/available'),
  getMembers: (id) => request.get(`/organizations/${id}/members`),
  addMember: (orgId, userId) => request.post(`/organizations/${orgId}/members`, { user_id: userId }),
  removeMember: (orgId, userId) => request.delete(`/organizations/${orgId}/members/${userId}`),
};

// 用户管理 API
export const userAPI = {
  list: (params) => request.get('/auth/users', { params }),
  create: (data) => request.post('/auth/users', data),
  update: (id, data) => request.put(`/auth/users/${id}`, data),
  delete: (id) => request.delete(`/auth/users/${id}`),
  getOrganizations: () => request.get('/auth/organizations'),
};

// 模型测试 API
export const testResultsAPI = {
  list: (params) => request.get('/test-results', { params }),
  create: (data) => request.post('/test-results', data),
  batchCreate: (data) => request.post('/test-results/batch', data),
  update: (id, data) => request.put(`/test-results/${id}`, data),
  delete: (id) => request.delete(`/test-results/${id}`),
  batchDelete: (data) => request.post('/test-results/batch-delete', data),
  deleteAll: () => request.post('/test-results/delete-all'),
  export: (data) => request.post('/test-results/export', data, { responseType: 'blob' }),
  runTest: (id, aiConfigId) => request.post('/test-results/run-test', { id, ai_config_id: aiConfigId }),
  runBatchTest: (ids, aiConfigId) => request.post('/test-results/run-batch-test', { ids, ai_config_id: aiConfigId }),
  importFromQuestions: (data) => request.post('/test-results/import-from-questions', data),
  importPreview: (formData) => request.post('/test-results/import/preview', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getTestTypes: () => request.get('/test-results/test-types'),
  getResponseTypes: () => request.get('/test-results/response-types'),
  getRiskTypes: () => request.get('/test-results/risk-types'),
  getRiskCategories: () => request.get('/test-results/risk-categories'),
  getExistingQuestionIds: () => request.get('/test-results/existing-question-ids'),

  /**
   * WebSocket批量测试（带实时进度）
   * @param {number[]} ids - 测试ID数组
   * @param {number} aiConfigId - AI配置ID
   * @param {number} concurrency - 并发数
   * @param {Function} onProgress - 进度回调 (progress) => void
   * @param {Function} onComplete - 完成回调 (result) => void
   * @param {Function} onError - 错误回调 (error) => void
   * @returns {WebSocket} WebSocket实例，可调用 close() 取消
   */
  runBatchTestWebSocket(ids, aiConfigId, concurrency, onProgress, onComplete, onError) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/test`;

    console.log('[WS] 连接WebSocket:', wsUrl);
    const ws = new WebSocket(wsUrl);

    const cleanup = () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };

    ws.onopen = () => {
      console.log('[WS] 连接成功，发送测试请求');
      ws.send(JSON.stringify({ ids, ai_config_id: aiConfigId, concurrency }));
    };

    ws.onmessage = (event) => {
      console.log('[WS] 收到消息:', event.data);
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'progress') {
          onProgress && onProgress(data);
        } else if (data.type === 'complete') {
          onComplete && onComplete(data);
          cleanup();
        } else if (data.type === 'error') {
          onError && onError(new Error(data.message));
          cleanup();
        }
      } catch (e) {
        console.error('[WS] 消息解析失败:', e);
        onError && onError(e);
      }
    };

    ws.onerror = (error) => {
      console.error('[WS] 连接错误:', error);
      onError && onError(new Error('WebSocket连接失败，请检查服务器是否启动'));
    };

    ws.onclose = (event) => {
      console.log('[WS] 连接关闭:', event.code, event.reason);
    };

    return ws;
  },
};
