import { createApp } from 'vue';
import TDesign from 'tdesign-vue-next';
import App from './App.vue';
import router from './router';
import 'tdesign-vue-next/dist/tdesign.css';

const app = createApp(App);
app.use(TDesign);
app.use(router);
app.mount('#app');
