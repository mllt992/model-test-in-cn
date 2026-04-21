const express = require('express');
const db = require('../database/init');

const router = express.Router();

// 题目类别占比
router.get('/category-distribution', (req, res) => {
  const rows = db.prepare(
    "SELECT category, COUNT(*) AS count FROM questions WHERE category IS NOT NULL AND category != '' GROUP BY category ORDER BY count DESC"
  ).all();
  res.json({ code: 200, data: rows });
});

// 测试题类型占比
router.get('/type-distribution', (req, res) => {
  const rows = db.prepare(
    "SELECT type, COUNT(*) AS count FROM questions WHERE type IS NOT NULL AND type != '' GROUP BY type ORDER BY count DESC"
  ).all();
  res.json({ code: 200, data: rows });
});

// 类别拒答情况统计
router.get('/category-rejection', (req, res) => {
  const rows = db.prepare(`
    SELECT
      category,
      SUM(CASE WHEN is_refused = 1 THEN 1 ELSE 0 END) AS refused,
      SUM(CASE WHEN is_refused = 0 THEN 1 ELSE 0 END) AS answered
    FROM questions
    WHERE category IS NOT NULL AND category != ''
    GROUP BY category
    ORDER BY category
  `).all();
  res.json({ code: 200, data: rows });
});

// 题目词云词频（对 question 字段做简单中文分词统计）
router.get('/question-wordcloud', (req, res) => {
  const rows = db.prepare('SELECT question FROM questions').all();
  const freq = {};
  rows.forEach(({ question }) => {
    tokenize(question).forEach((w) => {
      freq[w] = (freq[w] || 0) + 1;
    });
  });
  const data = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 150)
    .map(([name, value]) => ({ name, value }));
  res.json({ code: 200, data });
});

// 回答词云词频（对 model_answer 字段做简单中文分词统计）
router.get('/answer-wordcloud', (req, res) => {
  const rows = db.prepare("SELECT model_answer FROM questions WHERE model_answer IS NOT NULL AND model_answer != ''").all();
  const freq = {};
  rows.forEach(({ model_answer }) => {
    tokenize(model_answer).forEach((w) => {
      freq[w] = (freq[w] || 0) + 1;
    });
  });
  const data = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 150)
    .map(([name, value]) => ({ name, value }));
  res.json({ code: 200, data });
});

// 简易中文分词：提取2-4字连续片段，过滤常见停用词
function tokenize(text) {
  if (!text) return [];
  const STOP_WORDS = new Set([
    '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个',
    '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好',
    '自己', '这', '他', '她', '它', '们', '那', '被', '从', '把', '让', '对', '为',
    '什么', '与', '及', '其', '或', '等', '可', '但', '而', '所', '以', '能', '将',
    '可以', '这个', '那个', '因为', '所以', '但是', '如果', '已经', '还是', '只是',
    '如何', '怎样', '哪些', '每个', '以及', '通过', '进行', '使用', '关于', '之间',
    '根据', '目前', '情况', '问题', '需要', '相关', '同时', '方面', '是否', '属于',
    '其中', '这样', '那样', '一些', '一种', '不是', '没有', '应该', '可能', '已经',
  ]);
  // 移除标点、数字、英文
  const cleaned = text.replace(/[a-zA-Z0-9\s\p{P}\p{S}]/gu, '');
  const words = new Set();
  for (let len = 2; len <= 4; len++) {
    for (let i = 0; i <= cleaned.length - len; i++) {
      const w = cleaned.substring(i, i + len);
      if (!STOP_WORDS.has(w)) words.add(w);
    }
  }
  return [...words];
}

module.exports = router;
