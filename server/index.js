const express = require('express');
const cors = require('cors');
const config = require('./config');
const db = require('./database/init');

const app = express();

// 文件大小限制配置
const BODY_SIZE_LIMIT = '50mb';

// 初始化数据库
require('./database/init');

app.use(cors());
app.use(express.json({ limit: BODY_SIZE_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: BODY_SIZE_LIMIT }));

// 路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/blockwords', require('./routes/blockwords'));
app.use('/api/questions', require('./routes/questions'));
app.use('/api/ai-config', require('./routes/aiConfig'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/ai-generate', require('./routes/aiGenerate'));

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ code: 200, message: 'OK' });
});

app.listen(config.PORT, () => {
  console.log('> Server running at http://localhost:' + config.PORT);
});
