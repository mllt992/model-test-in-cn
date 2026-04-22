# 大模型备案数据管理系统

基于 Vue 3 + Express 的模型备案数据管理平台，支持 AI 生成内容管理、测试题管理、模型测试等核心功能。

## 技术栈

| 端 | 技术 |
|---|---|
| 前端 | Vue 3 + TDesign + Vite + ECharts |
| 后端 | Express + better-sqlite3 |
| 通信 | REST API + WebSocket |
| 协议 | OpenAI / Codex / Claude / Gemini |

## 项目结构

```
model-test/
├── client/                 # 前端应用
│   ├── src/
│   │   ├── api/           # API 请求封装
│   │   ├── router/        # 路由配置
│   │   ├── views/         # 页面组件
│   │   └── utils/          # 工具函数
│   └── vite.config.js
├── server/                 # 后端服务
│   ├── database/          # SQLite 数据库
│   ├── middleware/       # 中间件
│   ├── routes/            # 路由
│   ├── utils/             # 工具函数
│   ├── index.js           # 入口文件
│   └── websocket.js       # WebSocket 服务
├── uploads/               # 上传文件目录
├── export/                # 导出文件目录
└── temp/                  # 临时文件目录
```

## 功能模块

### 登录认证
- 账号密码登录
- JWT 令牌认证
- 组织数据隔离

### 拦截词管理
- 敏感词配置与管理

### AI 生成
- 多渠道 AI 配置（OpenAI/Codex/Claude/Gemini）
- 类型与类别筛选
- 拒答规则配置
- Prompt 模板管理
- 生成结果表格展示
- 批量添加到测试集

### 测试题管理
- **搜索筛选**: 题目/类别/模型回答模糊搜索、人工审核状态筛选
- **导入导出**: Excel/CSV/JSON 格式，支持字段映射与默认值配置
- **数据展示**: 序号、类型、题目、类别、模型回答、是否拒答、备注、人工审核
- **批量操作**: 批量编辑、删除、移动

### 模型测试
- 测试数据来源：文件上传或系统已有数据
- WebSocket 并发测试
- 自动判断回答类型（合理回答/合理拒答/异常回复）
- 测试报告生成与导出

### 系统设置
- **AI 配置**: API 地址、密钥、协议选择、模型动态加载
- **组织管理**: 组织架构管理，分配组织管理员
- **用户管理**: 用户 CRUD，数据按组织隔离

## 快速开始

### 环境要求
- Node.js >= 18

### 安装依赖

```bash
# 前端依赖
cd client && npm install

# 后端依赖
cd ../server && npm install
```

### 启动服务

```bash
# 启动后端 (端口 3001)
cd server && npm run dev

# 启动前端 (端口 5173)
cd client && npm run dev
```

访问 http://localhost:5173

### 默认账号
- 用户名: `xrilang`
- 密码: `123456`

## API 端口

| 服务 | 端口 |
|---|---|
| 前端开发服务器 | 5173 |
| 后端 API | 3001 |
| WebSocket | 3001 |

## 数据说明

- 数据库: `server/database/data.db` (SQLite)
- 上传文件: `uploads/`
- 导出文件: `export/`
- 临时文件: `temp/`

以上目录已配置为 `.gitignore`，不会被提交。
