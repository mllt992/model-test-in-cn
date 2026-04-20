const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/init');
const config = require('../config');

const router = express.Router();

// 登录
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ code: 400, message: '用户名和密码不能为空' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    return res.status(401).json({ code: 401, message: '用户名或密码错误' });
  }

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) {
    return res.status(401).json({ code: 401, message: '用户名或密码错误' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, nickname: user.nickname },
    config.JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    code: 200,
    message: '登录成功',
    data: { token, user: { id: user.id, username: user.username, nickname: user.nickname } },
  });
});

// 获取当前用户信息
router.get('/me', require('../middleware/auth'), (req, res) => {
  res.json({ code: 200, data: req.user });
});

module.exports = router;
