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
  approve: (id, username) => request.post(`/questions/${id}/approve`, { username }),
  revokeApprove: (id, username) => request.post(`/questions/${id}/revoke-approve`, { username }),
  getDuplicates: () => request.get('/questions/duplicates'),
  removeDuplicates: (ids) => request.post('/questions/remove-duplicates', { ids }),
  getTypes: () => request.get('/questions/types'),
  getCategories: () => request.get('/questions/categories'),
};

export const statsAPI = {
  categoryDistribution: () => request.get('/stats/category-distribution'),
  typeDistribution: () => request.get('/stats/type-distribution'),
  categoryRejection: () => request.get('/stats/category-rejection'),
  questionWordcloud: () => request.get('/stats/question-wordcloud'),
  answerWordcloud: () => request.get('/stats/answer-wordcloud'),
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
