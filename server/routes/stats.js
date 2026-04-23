const express = require('express');
const db = require('../database/init');

const router = express.Router();

// 聚合接口：一次返回全部统计数据
router.get('/all', (req, res) => {
  const typeDistribution = db.prepare(
    "SELECT type, COUNT(*) AS count FROM questions WHERE type IS NOT NULL AND type != '' GROUP BY type ORDER BY count DESC"
  ).all();

  const categoryDistribution = db.prepare(
    "SELECT category, COUNT(*) AS count FROM questions WHERE category IS NOT NULL AND category != '' GROUP BY category ORDER BY count DESC"
  ).all();

  const categoryRejection = db.prepare(`
    SELECT category,
      SUM(CASE WHEN is_refused = 1 THEN 1 ELSE 0 END) AS refused,
      SUM(CASE WHEN is_refused = 0 THEN 1 ELSE 0 END) AS answered
    FROM questions WHERE category IS NOT NULL AND category != ''
    GROUP BY category ORDER BY category
  `).all();

  res.json({ code: 200, data: { typeDistribution, categoryDistribution, categoryRejection } });
});

module.exports = router;
