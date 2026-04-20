import axios from 'axios';
import { MessagePlugin } from 'tdesign-vue-next';

const request = axios.create({
  baseURL: '/api',
  timeout: 300000, // 5分钟，支持AI生成
});

// 请求拦截器：注入 Token
request.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器：统一错误处理
request.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    MessagePlugin.error(error.response?.data?.message || '请求失败');
    return Promise.reject(error);
  }
);

export default request;
