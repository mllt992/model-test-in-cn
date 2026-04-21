<template>
  <t-layout class="app-layout">
    <t-aside class="app-aside" width="220px">
      <div class="logo">大模型备案</div>
      <t-menu theme="light" :value="activeMenu" @change="handleMenuChange">
        <t-menu-item value="dashboard">
          <template #icon><t-icon name="dashboard" /></template>
          数据统计
        </t-menu-item>
        <t-menu-item value="ai-generate">
          <template #icon><t-icon name="chat" /></template>
          AI生成
        </t-menu-item>
        <t-menu-item value="blockwords">
          <template #icon><t-icon name="filter" /></template>
          拦截词管理
        </t-menu-item>
        <t-menu-item value="questions">
          <template #icon><t-icon name="chat" /></template>
          测试题管理
        </t-menu-item>
        <t-submenu value="settings">
          <template #icon><t-icon name="setting" /></template>
          <template #title>系统设置</template>
          <t-menu-item value="settings">
            <template #icon><t-icon name="app" /></template>
            AI配置
          </t-menu-item>
          <t-menu-item value="organizations">
            <template #icon><t-icon name="group" /></template>
            组织管理
          </t-menu-item>
          <t-menu-item value="users">
            <template #icon><t-icon name="user" /></template>
            用户管理
          </t-menu-item>
        </t-submenu>
      </t-menu>
    </t-aside>
    <t-layout class="app-main">
      <t-header class="app-header">
        <div class="header-right">
          <span class="user-name">{{ user.nickname || user.username }}</span>
          <t-button variant="text" size="small" theme="danger" @click="handleLogout">退出登录</t-button>
        </div>
      </t-header>
      <t-content class="app-content">
        <router-view />
      </t-content>
    </t-layout>
  </t-layout>
</template>

<script setup>
import { computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';

const router = useRouter();
const route = useRoute();
const user = JSON.parse(localStorage.getItem('user') || '{}');
const activeMenu = computed(() => {
  const path = route.path.replace('/', '');
  // 匹配 settings 下的子路由
  if (path.startsWith('settings')) return 'settings';
  return path;
});

const handleMenuChange = (value) => {
  router.push('/' + value);
};

const handleLogout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  router.push('/login');
};
</script>

<style scoped>
.app-layout {
  height: 100vh;
  overflow: hidden;
}
.app-aside {
  height: 100vh;
  background: #fff;
  border-right: 1px solid #e7e7e7;
  flex-shrink: 0;
}
.logo {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 700;
  color: #0052d9;
  border-bottom: 1px solid #e7e7e7;
  flex-shrink: 0;
}
.app-main {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.app-header {
  height: 56px;
  background: #fff;
  border-bottom: 1px solid #e7e7e7;
  padding: 0 24px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.user-name {
  font-size: 14px;
  color: #333;
}
.app-content {
  flex: 1;
  overflow: hidden;
  padding: 16px 24px;
  background: #f0f2f5;
}
</style>
