module.exports = {
  JWT_SECRET: 'model-archive-secret-key-2024',
  PORT: process.env.PORT || 3001,
  UPLOAD_DIR: require('path').join(__dirname, '..', 'uploads'),
  PAGE_SIZE: 10,
};
