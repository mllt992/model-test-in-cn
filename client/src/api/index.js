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
  export: (data) => request.post('/questions/export', data, { responseType: 'blob' }),
  importFile: (formData) => request.post('/questions/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  importPreview: (formData) => request.post('/questions/import/preview', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
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
};
