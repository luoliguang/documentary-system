# 项目设置指南

## 快速开始

### 1. 安装依赖

```bash
# 安装所有依赖（根目录、前端、后端）
npm run install:all
```

### 2. 配置环境变量

#### 后端环境变量

复制并编辑后端环境变量文件：

```bash
# Windows
copy backend\.env.example backend\.env

# Linux/macOS
cp backend/.env.example backend/.env
```

编辑 `backend/.env` 文件，修改数据库配置：

```env
# 服务器配置
PORT=3006
NODE_ENV=development

# JWT 配置（生产环境请修改）
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# CORS 配置
CORS_ORIGIN=http://localhost:5176

# 数据库配置（请根据实际情况修改）
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fangdu_db
DB_USER=postgres
DB_PASSWORD=your_password_here
```

### 3. 初始化数据库

#### 方法一：使用自动化脚本（推荐）

**Windows PowerShell:**
```powershell
cd database
.\init-db.ps1
```

**Windows CMD:**
```cmd
cd database
init-db.bat
```

**Linux/macOS:**
```bash
cd database
chmod +x init-db.sh
./init-db.sh
```

#### 方法二：手动初始化

```bash
# 1. 创建数据库
createdb -U postgres fangdu_db

# 2. 导入数据库结构
psql -U postgres -d fangdu_db -f database/schema.sql

# 3. 导入初始数据（可选）
psql -U postgres -d fangdu_db -f database/init.sql
```

### 4. 启动开发服务器

```bash
# 同时启动前端和后端
npm run dev

# 或者分别启动
npm run dev:frontend  # 前端：http://localhost:5176
npm run dev:backend   # 后端：http://localhost:3006
```

## 访问应用

- **前端地址**: http://localhost:5176
- **后端API**: http://localhost:3006
- **健康检查**: http://localhost:3006/health

## 默认账号

- **管理员**
  - 用户名: `admin`
  - 密码: `admin123`

- **测试客户**
  - 用户名: `customer001`
  - 密码: `admin123`

⚠️ **重要**: 生产环境请务必修改这些默认密码！

## 项目结构

```
fangdu-website-follow/
├── backend/          # 后端代码
│   ├── src/
│   │   ├── config/   # 配置文件
│   │   ├── controllers/  # 控制器
│   │   ├── routes/   # 路由
│   │   ├── middleware/   # 中间件
│   │   └── index.ts  # 入口文件
│   └── .env          # 环境变量（需要创建）
├── frontend/         # 前端代码
│   └── src/
│       ├── api/      # API 服务
│       ├── stores/   # 状态管理
│       ├── views/    # 页面组件
│       └── components/   # 可复用组件
├── database/         # 数据库脚本
│   ├── schema.sql    # 数据库结构
│   ├── init.sql      # 初始数据
│   └── init-db.*     # 初始化脚本
└── package.json      # 项目配置
```

## 常见问题

### 1. PostgreSQL 连接失败

**检查项：**
- PostgreSQL 服务是否运行
- `.env` 文件中的数据库配置是否正确
- 数据库用户权限是否正确
- 防火墙是否阻止了连接

### 2. 端口被占用

**解决方案：**
- 修改 `backend/.env` 中的 `PORT`
- 或修改 `frontend/vite.config.ts` 中的端口配置

### 3. 前端无法连接后端

**检查项：**
- 后端服务是否正常运行
- `CORS_ORIGIN` 配置是否正确
- 前端代理配置是否正确（`vite.config.ts`）

### 4. JWT 认证失败

**检查项：**
- `.env` 文件中的 `JWT_SECRET` 是否正确
- Token 是否过期
- 请求头中是否包含正确的 Authorization

## 开发说明

### 添加新功能

1. **数据库**: 在 `database/schema.sql` 中添加表结构
2. **后端**: 
   - 在 `controllers/` 添加控制器
   - 在 `routes/` 添加路由
3. **前端**: 
   - 在 `api/` 添加 API 调用
   - 在 `views/` 添加页面组件
   - 在 `stores/` 添加状态管理

### 代码规范

- 使用 TypeScript 严格模式
- 遵循 ESLint 规则
- 使用有意义的变量和函数名
- 添加必要的注释

## 生产部署

1. 修改 `.env` 中的配置
2. 设置 `NODE_ENV=production`
3. 修改 `JWT_SECRET` 为强随机字符串
4. 使用 HTTPS
5. 配置数据库连接池
6. 启用日志记录
7. 配置反向代理（如 Nginx）

## 技术支持

如有问题，请查看：
- `README.md` - 项目说明
- `database/README.md` - 数据库说明
- 项目 Issues

