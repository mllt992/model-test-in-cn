<template>
  <div class="login-container">
    <t-card class="login-card">
      <div class="login-header">
        <h2>大模型备案数据管理</h2>
        <p>登录您的账号</p>
      </div>
      <t-form :data="form" :rules="rules" @submit="handleLogin">
        <t-form-item label="账号" name="username">
          <t-input v-model="form.username" placeholder="请输入账号" />
        </t-form-item>
        <t-form-item label="密码" name="password">
          <t-input v-model="form.password" type="password" placeholder="请输入密码" />
        </t-form-item>
        <t-form-item>
          <t-button type="submit" theme="primary" block :loading="loading">登录</t-button>
        </t-form-item>
      </t-form>
    </t-card>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { MessagePlugin } from 'tdesign-vue-next';
import { authAPI } from '@/api';

const router = useRouter();
const loading = ref(false);
const form = ref({ username: '', password: '' });
const rules = {
  username: [{ required: true, message: '账号不能为空' }],
  password: [{ required: true, message: '密码不能为空' }],
};

const handleLogin = async ({ validateResult }) => {
  if (validateResult !== true) return;
  loading.value = true;
  try {
    const res = await authAPI.login(form.value);
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('user', JSON.stringify(res.data.user));
    MessagePlugin.success('登录成功');
    router.push('/');
  } catch (e) {
    MessagePlugin.error(e?.response?.data?.message || '登录失败');
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0052d9 0%, #0052d9 100%);
}
.login-card {
  width: 400px;
  padding: 32px;
}
.login-header {
  text-align: center;
  margin-bottom: 32px;
}
.login-header h2 {
  font-size: 24px;
  color: #1f1f1f;
  margin-bottom: 8px;
}
.login-header p {
  color: #888;
  font-size: 14px;
}
</style>
