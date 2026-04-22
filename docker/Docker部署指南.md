# Docker 部署指南

## 快速启动

```bash
# 构建并启动所有服务
docker-compose up -d --build

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

启动后访问：
- 前端: http://localhost
- 后端 API: http://localhost:3001

## 服务说明

| 服务 | 端口 | 说明 |
|------|------|------|
| client | 80 | 前端 Vue 应用 (Nginx) |
| server | 3001 | 后端 Node.js API |

## 数据持久化

- **数据库**: `sqlite_data` volume - 持久化 SQLite 数据库
- **上传文件**: `uploads` volume - 持久化用户上传的文件

## 常用命令

```bash
# 停止服务
docker-compose down

# 重新构建
docker-compose up -d --build --force-recreate

# 进入后端容器
docker exec -it model-test-server sh

# 进入数据库
docker exec -it model-test-server sqlite3 /app/data/model-test.db

# 查看数据库文件
docker exec -it model-test-server ls -la /app/data/

# 清空所有数据（包括数据库）
docker-compose down -v
```

## 开发模式

如果只需要后端服务（本地运行前端进行开发）：

```bash
# 只启动后端
docker-compose up -d server
```

## 生产环境注意

1. 首次启动会自动创建数据库
2. 建议定期备份 `/app/data/model-test.db` 文件
3. 可以通过环境变量覆盖配置：
   - `PORT`: 服务端口（默认 3001）
   - `JWT_SECRET`: JWT 密钥
