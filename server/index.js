const express = require('express');
const cors = require('cors');
const config = require('./config');
const db = require('./database/init');

const app = express();

// 初始化数据库
require('./database/init');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/blockwords', require('./routes/blockwords'));
app.use('/api/questions', require('./routes/questions'));
app.use('/api/ai-config', require('./routes/aiConfig'));

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ code: 200, message: 'OK' });
});

app.listen(config.PORT, () => {
  console.log('> Server running at http://localhost:' + config.PORT);
});
