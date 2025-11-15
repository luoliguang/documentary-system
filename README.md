# 跟单系统 - 服装行业订单管理系统

这是一个完整的跟单系统，主要用于服装行业的订单管理，采用 Vue3 + Node.js + PostgreSQL 技术栈。

## 项目架构

### 后端架构 (Backend)

```
backend/
├── src/
│   ├── config/          # 配置文件
│   │   ├── database.ts  # 数据库配置
│   │   └── env.ts       # 环境变量配置
│   ├── controllers/     # 控制器层（业务逻辑）
│   │   ├── authController.ts      # 认证控制器
│   │   ├── orderController.ts     # 订单控制器
│   │   └── reminderController.ts  # 催货控制器
│   ├── routes/          # 路由层（API路由定义）
│   │   ├── authRoutes.ts      # 认证路由
│   │   ├── orderRoutes.ts     # 订单路由
│   │   └── reminderRoutes.ts  # 催货路由
│   ├── middleware/      # 中间件
│   │   └── auth.ts      # 认证中间件（JWT验证、权限控制）
│   ├── types/           # TypeScript 类型定义
│   │   └── index.ts
│   ├── utils/           # 工具函数
│   │   ├── jwt.ts       # JWT 工具
│   │   └── password.ts  # 密码加密工具
│   └── index.ts         # 主入口文件
└── package.json
```

### 前端架构 (Frontend)

```
frontend/
├── src/
│   ├── api/             # API 服务层
│   │   ├── auth.ts      # 认证API
│   │   ├── orders.ts    # 订单API
│   │   └── reminders.ts # 催货API
│   ├── stores/          # Pinia 状态管理
│   │   ├── auth.ts      # 认证状态
│   │   └── orders.ts    # 订单状态
│   ├── views/           # 页面组件
│   │   ├── Login.vue                           # 登录页面
│   │   ├── orders/
│   │   │   ├── OrderList.vue    # 订单列表
│   │   │   ├── OrderDetail.vue  # 订单详情
│   │   │   └── OrderCreate.vue  # 创建订单（管理员）
│   │   └── reminders/
│   │       └── ReminderList.vue # 催货记录列表
│   ├── components/      # 可复用组件
│   │   ├── layouts/
│   │   │   └── MainLayout.vue   # 主布局组件
│   │   ├── OrderEditDialog.vue  # 订单编辑对话框
│   │   └── ReminderDialog.vue   # 催货对话框
│   ├── router/          # 路由配置
│   │   └── index.ts
│   ├── utils/           # 工具函数
│   │   └── request.ts   # Axios 封装
│   ├── types/           # TypeScript 类型定义
│   │   └── index.ts
│   ├── App.vue          # 根组件
│   └── main.ts          # 入口文件
└── package.json
```

## 核心功能

### 1. 用户权限系统
- **管理员 (admin)**: 可以查看所有订单、创建订单、编辑订单、完成任务、回复催货
- **客户 (customer)**: 只能查看自己的订单、提交订单编号、创建催货记录

### 2. 订单管理
- 订单列表（支持筛选和分页）
- 订单详情（包含状态历史）
- 创建订单（仅管理员）
- 编辑订单（仅管理员）
- **完成任务**（仅管理员）- 在表格中可以标记订单为完成状态
- 客户可以提交自己的订单编号

### 3. 催货功能
- 客户可以创建催货记录（普通/紧急）
- 管理员可以查看所有催货记录并回复
- 催货状态跟踪（待处理/已处理）

### 4. 订单字段
- 订单编号
- 客户编号
- 客户订单编号（客户可提交）
- 订单状态（pending/in_production/completed/shipped/cancelled）
- **是否完成任务** (is_completed)
- 是否可以出货 (can_ship)
- 预计出货日期 (estimated_ship_date)
- 实际出货日期 (actual_ship_date)
- 情况备注 (notes)
- 内部备注 (internal_notes) - 仅管理员可见

## 数据库设计

主要数据表：
- `users` - 用户表（管理员和客户）
- `orders` - 订单表
- `delivery_reminders` - 催货记录表
- `order_status_history` - 订单状态历史表

详细数据库设计见 `database/schema.sql`

## 环境配置

### 后端环境变量 (.env)

```env
PORT=3000
NODE_ENV=development
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:5173

DB_HOST=localhost
DB_PORT=5432
DB_NAME=fangdu_db
DB_USER=postgres
DB_PASSWORD=your_password
```

### 前端环境变量

无需配置，默认使用代理到后端 API

## 安装和运行

### 1. 安装依赖

```bash
# 安装所有依赖（根目录、前端、后端）
npm run install:all
```

或者分别安装：

```bash
# 根目录
npm install

# 前端
cd frontend
npm install

# 后端
cd backend
npm install
```

### 2. 数据库初始化

```bash
# 创建数据库
createdb fangdu_db

# 导入数据库结构
psql -U postgres -d fangdu_db -f database/schema.sql

# 导入初始数据（可选）
psql -U postgres -d fangdu_db -f database/init.sql
```

### 3. 启动开发服务器

```bash
# 同时启动前端和后端
npm run dev

# 或分别启动
npm run dev:frontend  # 前端：http://localhost:5173
npm run dev:backend   # 后端：http://localhost:3000
```

### 4. 默认账号

- **管理员账号**: `admin` / `admin123`
- **测试客户**: `customer001` / `admin123`

## API 文档

### 认证接口
- `POST /api/auth/login` - 登录
- `GET /api/auth/me` - 获取当前用户信息
- `POST /api/auth/customers` - 创建客户（管理员）

### 订单接口
- `GET /api/orders` - 获取订单列表
- `GET /api/orders/:id` - 获取订单详情
- `POST /api/orders` - 创建订单（管理员）
- `PUT /api/orders/:id` - 更新订单（管理员）
- `PATCH /api/orders/:id/complete` - **完成任务**（管理员）
- `PATCH /api/orders/:id/customer-order-number` - 更新客户订单编号（客户）
- `GET /api/orders/:id/history` - 获取订单状态历史
- `GET /api/orders/customers/list` - 获取客户列表（管理员）

### 催货接口
- `POST /api/reminders` - 创建催货记录（客户）
- `GET /api/reminders` - 获取催货记录列表
- `PATCH /api/reminders/:id/respond` - 回复催货（管理员）

## 技术栈

- **前端**: Vue 3 + TypeScript + Vite + Element Plus + Pinia + Vue Router
- **后端**: Node.js + Express + TypeScript + PostgreSQL + JWT
- **数据库**: PostgreSQL

## 项目特点

1. **权限分离**: 清晰的权限控制，管理员和客户功能完全隔离
2. **数据安全**: JWT 认证，客户只能访问自己的订单数据
3. **完整功能**: 包含订单管理的全流程功能
4. **状态追踪**: 订单状态历史记录，便于追踪订单变化
5. **催货系统**: 客户可以催货，管理员可以回复，形成完整的沟通闭环
6. **完成任务功能**: 在表格中可以直接标记订单为完成状态

## 注意事项

1. 请修改默认密码和 JWT_SECRET
2. 生产环境请使用 HTTPS
3. 建议使用环境变量管理敏感信息
4. 数据库定期备份

## 开发说明

### 代码组织原则

1. **分层架构**: 严格区分路由层、控制器层、服务层
2. **组件化**: 前端组件按功能模块组织
3. **类型安全**: 全面使用 TypeScript 类型定义
4. **权限控制**: 后端中间件 + 前端路由守卫双重保障

### 添加新功能

1. 数据库：在 `database/schema.sql` 中添加表结构
2. 后端：在 `controllers/` 添加控制器，在 `routes/` 添加路由
3. 前端：在 `api/` 添加 API 调用，在 `views/` 添加页面组件
4. 类型：在 `types/` 中添加 TypeScript 类型定义

## 许可证

MIT

