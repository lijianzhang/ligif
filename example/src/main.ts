import { createApp } from 'vue';
import antd from 'ant-design-vue';
import 'ant-design-vue/dist/antd.min.css';
import App from './app.vue';

const app = createApp(App);

app.use(antd);

app.mount('#app');
