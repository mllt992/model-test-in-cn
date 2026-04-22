import { createRouter, createWebHashHistory } from 'vue-router';
import Login from '../views/Login.vue';
import Layout from '../views/Layout.vue';
import Dashboard from '../views/Dashboard.vue';
import Blockwords from '../views/Blockwords.vue';
import Questions from '../views/Questions.vue';
import AIConfig from '../views/AIConfig.vue';
import AIGenerate from '../views/AIGenerate.vue';
import Organizations from '../views/Organizations.vue';
import Users from '../views/Users.vue';
import ModelTest from '../views/ModelTest.vue';

const routes = [
  { path: '/login', component: Login },
  {
    path: '/',
    component: Layout,
    redirect: '/dashboard',
    children: [
      { path: 'dashboard', component: Dashboard },
      { path: 'ai-generate', component: AIGenerate },
      { path: 'model-test', component: ModelTest },
      { path: 'blockwords', component: Blockwords },
      { path: 'questions', component: Questions },
      { path: 'settings', component: AIConfig },
      { path: 'organizations', component: Organizations },
      { path: 'users', component: Users },
    ],
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

// 路由守卫
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token');
  if (to.path !== '/login' && !token) {
    next('/login');
  } else if (to.path === '/login' && token) {
    next('/');
  } else {
    next();
  }
});

export default router;
