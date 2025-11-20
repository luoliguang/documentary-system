# 跟单系统架构文档

> **文档版本**: v1.0  
> **最后更新**: 2024年  
> **架构师**: AI首席架构师

---

## 目录

1. [C4 Level 1 上下文图](#c4-level-1-上下文图)
2. [当前模块/文件夹结构树](#当前模块文件夹结构树)
3. [数据库表结构](#数据库表结构)
4. [权限体系](#权限体系)
5. [核心业务流程时序描述](#核心业务流程时序描述)
6. [架构坏味道和潜在风险](#架构坏味道和潜在风险)

---

## C4 Level 1 上下文图

### 系统上下文

```
┌─────────────────────────────────────────────────────────────────┐
│                        跟单系统 (Fangdu System)                  │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  前端应用    │  │  后端API     │  │  数据库      │         │
│  │  (Vue3)      │◄─┤  (Express)   │◄─┤  (PostgreSQL)│         │
│  │  Port: 5176  │  │  Port: 3006  │  │  Port: 5432  │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │
         │                    │                    │
    ┌────▼────┐         ┌────▼────┐         ┌────▼────┐
    │  客户   │         │ 管理员  │         │生产跟单 │
    │Customer │         │  Admin  │         │Manager  │
    └─────────┘         └─────────┘         └─────────┘
         │                    │                    │
         │                    │                    │
    ┌────▼────────────────────▼────────────────────▼────┐
    │              外部系统/服务                          │
    │  • 阿里云OSS (图片存储)                            │
    │  • 邮件服务 (可选，未实现)                         │
    │  • 短信服务 (可选，未实现)                         │
    └────────────────────────────────────────────────────┘
```

### 系统边界说明

- **内部系统**: 前端Vue3应用、后端Express API、PostgreSQL数据库
- **外部用户**: 客户(Customer)、管理员(Admin)、生产跟单(Production Manager)
- **外部服务**: 阿里云OSS（用于图片存储）

---

## 当前模块/文件夹结构树

```
fangdu-website-follow/
├── backend/                          # 后端服务
│   ├── src/
│   │   ├── config/                   # 配置层
│   │   │   ├── database.ts          # 数据库连接池配置
│   │   │   └── env.ts               # 环境变量配置
│   │   ├── controllers/              # 控制器层（业务逻辑）
│   │   │   ├── authController.ts    # 认证控制器
│   │   │   ├── orders/              # 订单控制器（已拆分）
│   │   │   │   ├── orderQueryController.ts    # 查询控制器
│   │   │   │   ├── orderCreateController.ts   # 创建控制器
│   │   │   │   ├── orderUpdateController.ts   # 更新控制器
│   │   │   │   ├── orderAssignController.ts   # 分配控制器
│   │   │   │   ├── orderDeleteController.ts   # 删除控制器
│   │   │   │   └── index.ts                   # 统一导出
│   │   │   ├── reminderController.ts # 催货控制器
│   │   │   ├── followUpController.ts # 跟进记录控制器
│   │   │   ├── notificationController.ts # 通知控制器
│   │   │   ├── userController.ts    # 用户控制器
│   │   │   └── configController.ts  # 配置控制器
│   │   ├── routes/                   # 路由层（API路由定义）
│   │   │   ├── authRoutes.ts
│   │   │   ├── orderRoutes.ts
│   │   │   ├── reminderRoutes.ts
│   │   │   ├── followUpRoutes.ts
│   │   │   ├── notificationRoutes.ts
│   │   │   ├── userRoutes.ts
│   │   │   ├── configRoutes.ts
│   │   │   └── uploadRoutes.ts
│   │   ├── services/                 # 服务层（业务服务）
│   │   │   ├── configService.ts     # 配置服务（带缓存）
│   │   │   ├── rolePermissionService.ts # 角色权限服务（缓存+事件订阅）
│   │   │   ├── userPermissionOverrideService.ts # 用户权限覆盖服务
│   │   │   ├── followUpService.ts   # 跟进服务
│   │   │   ├── notificationService.ts # 通知服务
│   │   │   ├── permissionService.ts # 权限服务（集中权限检查）
│   │   │   └── ossService.ts        # OSS存储服务
│   │   ├── middleware/               # 中间件
│   │   │   ├── auth.ts              # JWT认证+权限中间件
│   │   │   └── validate.ts          # 输入验证中间件
│   │   ├── validators/               # 验证 Schema 层
│   │   │   ├── orderSchemas.ts      # 订单验证 Schema
│   │   │   ├── reminderSchemas.ts   # 催货验证 Schema
│   │   │   ├── followUpSchemas.ts   # 跟进验证 Schema
│   │   │   ├── authSchemas.ts       # 认证验证 Schema
│   │   │   ├── userSchemas.ts       # 用户验证 Schema
│   │   │   └── index.ts             # 统一导出
│   │   ├── events/                   # 事件总线与领域事件
│   │   │   ├── eventBus.ts          # Phase 2 事件驱动基座
│   │   │   └── configEvents.ts      # 配置相关领域事件
│   │   ├── errors/                   # 错误处理模块
│   │   │   ├── AppError.ts          # 自定义错误类和错误工厂
│   │   │   ├── errorHandler.ts      # 全局错误处理中间件
│   │   │   └── index.ts             # 统一导出
│   │   ├── constants/                # 常量定义
│   │   │   ├── orderStatus.ts       # 订单状态常量
│   │   │   ├── orderType.ts         # 订单类型常量
│   │   │   └── index.ts             # 常量统一导出
│   │   ├── utils/                    # 工具函数
│   │   │   ├── jwt.ts               # JWT工具
│   │   │   ├── password.ts          # 密码加密
│   │   │   ├── permissionCheck.ts   # 权限检查（RBAC）
│   │   │   └── configHelpers.ts     # 配置辅助函数
│   │   ├── types/                    # TypeScript类型定义
│   │   │   ├── index.ts
│   │   │   └── ali-oss.d.ts
│   │   └── index.ts                  # 应用入口
│   ├── uploads/                      # 本地文件上传目录
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                         # 前端应用
│   ├── src/
│   │   ├── api/                      # API调用层
│   │   │   ├── auth.ts
│   │   │   ├── orders.ts
│   │   │   ├── reminders.ts
│   │   │   ├── followUps.ts
│   │   │   ├── notifications.ts
│   │   │   ├── users.ts
│   │   │   └── configs.ts
│   │   ├── stores/                   # Pinia状态管理
│   │   │   ├── auth.ts              # 认证状态
│   │   │   ├── orders.ts            # 订单状态
│   │   │   └── notifications.ts     # 通知状态
│   │   ├── views/                    # 页面组件
│   │   │   ├── Login.vue
│   │   │   ├── orders/
│   │   │   │   ├── OrderList.vue
│   │   │   │   ├── OrderDetail.vue
│   │   │   │   └── OrderCreate.vue
│   │   │   ├── reminders/
│   │   │   │   └── ReminderList.vue
│   │   │   ├── followups/
│   │   │   │   └── FollowUpDashboard.vue
│   │   │   ├── users/
│   │   │   │   ├── Profile.vue
│   │   │   │   └── UserList.vue
│   │   │   └── configs/
│   │   │       ├── ConfigManagement.vue
│   │   │       └── components/
│   │   │           ├── OrderStatusManagement.vue
│   │   │           ├── OrderTypeManagement.vue
│   │   │           ├── RoleManagement.vue
│   │   │           └── PermissionManagement.vue
│   │   ├── components/               # 可复用组件
│   │   │   ├── layouts/
│   │   │   │   └── MainLayout.vue
│   │   │   ├── OrderEditDialog.vue
│   │   │   ├── OrderQuickAction.vue
│   │   │   ├── OrderAssignDialog.vue
│   │   │   ├── ReminderDialog.vue
│   │   │   ├── NotificationCenter.vue
│   │   │   ├── FollowUpRecord.vue
│   │   │   ├── orders/
│   │   │   │   └── OrderMobileCardList.vue
│   │   │   └── followups/
│   │   │       └── FollowUpSummaryCardList.vue
│   │   ├── composables/              # Vue组合式函数
│   │   │   ├── useConfigOptions.ts
│   │   │   └── useReminderStats.ts
│   │   ├── constants/                # 常量定义
│   │   │   ├── orderStatus.ts       # 订单状态常量
│   │   │   ├── orderType.ts         # 订单类型常量
│   │   │   └── index.ts             # 常量统一导出
│   │   ├── router/                   # 路由配置
│   │   │   └── index.ts
│   │   ├── utils/                    # 工具函数
│   │   │   ├── request.ts           # Axios封装
│   │   │   └── imageUtils.ts        # 图片工具
│   │   ├── types/                    # TypeScript类型定义
│   │   │   └── index.ts
│   │   ├── App.vue
│   │   └── main.ts
│   ├── package.json
│   └── vite.config.ts
│
├── database/                         # 数据库相关
│   ├── schema.sql                    # 数据库结构定义
│   ├── init.sql                      # 初始化数据
│   ├── migrations/                   # 数据库迁移脚本
│   │   └── 008_convert_estimated_ship_date_to_timestamp.sql
│   ├── run-migration.ps1
│   ├── run-config-migration.ps1
│   └── README.md
│
├── scripts/                          # 脚本工具
│   ├── run-migration.js
│   └── run-config-migration.js
│
├── private-docs/                     # 私有文档
│   └── *.md                          # 功能规划文档
│
├── README.md
├── SETUP.md
└── package.json
```

---

## 数据库表结构

### 1. users（用户表）

**用途**: 存储系统所有用户（客户、管理员、生产跟单）

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | SERIAL | PRIMARY KEY | 用户ID |
| account | VARCHAR(50) | UNIQUE, 可为空 | 登录账号（字母、数字、下划线） |
| username | VARCHAR(50) | NOT NULL | 用户名/显示名称（可含中文） |
| password_hash | VARCHAR(255) | NOT NULL | 密码哈希值（bcrypt） |
| customer_code | VARCHAR(50) | UNIQUE, 可为空 | 客户编号（管理员可为空） |
| role | VARCHAR(20) | NOT NULL, DEFAULT 'customer' | 角色：'customer'、'admin'、'production_manager' |
| assigned_order_types | JSONB | DEFAULT '[]' | 生产跟单的订单类型权限数组（空数组/NULL 代表拥有全部类型权限） |
| permission_overrides | JSONB | DEFAULT '{}' | 用户级权限覆盖（资源→权限键值，空对象表示无覆盖） |
| company_name | VARCHAR(200) | 可为空 | 公司名称 |
| contact_name | VARCHAR(100) | 可为空 | 联系人姓名 |
| email | VARCHAR(100) | 可为空 | 邮箱 |
| phone | VARCHAR(20) | 可为空 | 电话 |
| admin_notes | TEXT | 可为空 | 管理员备注 |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 更新时间（触发器自动更新） |
| is_active | BOOLEAN | DEFAULT true | 是否激活 |

**索引**:
- `id` (主键)
- `account` (唯一索引)
- `customer_code` (唯一索引)

**关联关系**:
- 一对多 → `orders.customer_id`
- 一对多 → `orders.assigned_to`
- 一对多 → `orders.created_by`
- 一对多 → `delivery_reminders.customer_id`
- 一对多 → `delivery_reminders.assigned_to`
- 一对多 → `order_status_history.changed_by`
- 一对多 → `notifications.user_id`
- 一对多 → `order_follow_ups.production_manager_id`

---

### 2. orders（订单表）

**用途**: 存储所有订单信息

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | SERIAL | PRIMARY KEY | 订单ID |
| order_number | VARCHAR(100) | UNIQUE, NOT NULL | 订单编号（工厂内部编号） |
| customer_id | INTEGER | NOT NULL, FK → users(id) | 客户ID |
| customer_code | VARCHAR(50) | 可为空 | 客户编号（冗余字段） |
| customer_order_number | VARCHAR(100) | 可为空 | 客户自己的订单编号 |
| status | VARCHAR(50) | DEFAULT 'pending' | 订单状态：pending, in_production, completed, shipped, cancelled, assigned |
| order_type | VARCHAR(20) | DEFAULT 'required' | 订单类型：required(必发)、scattered(散单)、photo(拍照) |
| assigned_to | INTEGER | FK → users(id), 可为空 | 分配给的生产跟单ID |
| is_completed | BOOLEAN | DEFAULT false | 是否完成任务 |
| can_ship | BOOLEAN | DEFAULT false | 是否可以出货 |
| estimated_ship_date | TIMESTAMP | 可为空 | 预计出货日期（日期+时间） |
| actual_ship_date | DATE | 可为空 | 实际出货日期 |
| order_date | TIMESTAMP | 可为空 | 下单时间 |
| notes | TEXT | 可为空 | 情况备注（客户可见） |
| internal_notes | TEXT | 可为空 | 内部备注（仅管理员可见） |
| images | JSONB | DEFAULT '[]' | 订单图片URL数组 |
| shipping_tracking_numbers | JSONB | DEFAULT '[]' | 发货单号数组，格式：[{"type": "main", "number": "SF123456", "label": "主单号"}] |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 更新时间（触发器自动更新） |
| created_by | INTEGER | FK → users(id), 可为空 | 创建者ID（管理员） |

#### order_assignments（订单分配表）

**用途**: 记录订单与生产跟单之间的多对多分配关系，支持协同处理

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | SERIAL | PRIMARY KEY | 分配记录ID |
| order_id | INTEGER | NOT NULL, FK → orders(id) ON DELETE CASCADE | 订单ID |
| production_manager_id | INTEGER | NOT NULL, FK → users(id) ON DELETE CASCADE | 被分配的生产跟单ID |
| assigned_by | INTEGER | FK → users(id) ON DELETE SET NULL | 发起分配的管理员ID |
| assigned_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 分配时间 |

**说明**:
- `orders.assigned_to` 保留为主负责人字段，用于兼容旧逻辑及快速过滤。
- 前端展示会聚合 `assigned_team`、`assigned_to_ids`、`assigned_to_names`，用于显示完整协同成员列表。
- 当分配列表为空时，订单状态会自动从 `assigned` 回退到 `pending`。

**索引**:
- `id` (主键)
- `order_number` (唯一索引)
- `customer_id` (idx_orders_customer_id)
- `customer_code` (idx_orders_customer_code)
- `status` (idx_orders_status)
- `is_completed` (idx_orders_is_completed)
- `can_ship` (idx_orders_can_ship)
- `order_type` (idx_orders_order_type)
- `assigned_to` (idx_orders_assigned_to)
- `estimated_ship_date` (idx_orders_estimated_ship_date)

**关联关系**:
- 多对一 → `users.id` (customer_id)
- 多对一 → `users.id` (assigned_to)
- 多对一 → `users.id` (created_by)
- 一对多 → `delivery_reminders.order_id`
- 一对多 → `order_status_history.order_id`
- 一对多 → `order_follow_ups.order_id`
- 一对多 → `notifications.related_id`（related_type='order'）

---

### 3. delivery_reminders（催货记录表）

**用途**: 存储客户催货记录

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | SERIAL | PRIMARY KEY | 催货记录ID |
| order_id | INTEGER | NOT NULL, FK → orders(id) ON DELETE CASCADE | 订单ID |
| customer_id | INTEGER | NOT NULL, FK → users(id) ON DELETE CASCADE | 客户ID |
| reminder_type | VARCHAR(20) | DEFAULT 'normal' | 催货类型：normal, urgent |
| message | TEXT | 可为空 | 催货消息 |
| admin_response | TEXT | 可为空 | 管理员回复 |
| is_admin_assigned | BOOLEAN | DEFAULT false | 是否为管理员派送的催货任务 |
| assigned_to | INTEGER | FK → users(id), 可为空 | 分配给的生产跟单ID |
| is_resolved | BOOLEAN | DEFAULT false | 是否已解决 |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| resolved_at | TIMESTAMP | 可为空 | 解决时间 |

**索引**:
- `id` (主键)
- `order_id` (idx_delivery_reminders_order_id)
- `customer_id` (idx_delivery_reminders_customer_id)
- `is_admin_assigned` (idx_delivery_reminders_is_admin_assigned)
- `assigned_to` (idx_delivery_reminders_assigned_to)

**关联关系**:
- 多对一 → `orders.id`
- 多对一 → `users.id` (customer_id)
- 多对一 → `users.id` (assigned_to)

---

### 4. order_status_history（订单状态历史表）

**用途**: 记录订单状态变更历史

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | SERIAL | PRIMARY KEY | 历史记录ID |
| order_id | INTEGER | NOT NULL, FK → orders(id) ON DELETE CASCADE | 订单ID |
| old_status | VARCHAR(50) | 可为空 | 旧状态 |
| new_status | VARCHAR(50) | 可为空 | 新状态 |
| changed_by | INTEGER | FK → users(id), 可为空 | 变更人ID |
| notes | TEXT | 可为空 | 备注 |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 创建时间 |

**索引**:
- `id` (主键)
- `order_id` (外键索引)

**关联关系**:
- 多对一 → `orders.id`
- 多对一 → `users.id` (changed_by)

---

### 5. order_follow_ups（订单跟进记录表）✅

**状态**: 已在schema.sql中定义（2024年修复）

**用途**: 存储生产跟单的订单跟进记录

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | SERIAL | PRIMARY KEY | 跟进记录ID |
| order_id | INTEGER | NOT NULL, FK → orders(id) | 订单ID |
| production_manager_id | INTEGER | NOT NULL, FK → users(id) | 生产跟单ID |
| content | TEXT | NOT NULL | 跟进内容 |
| is_visible_to_customer | BOOLEAN | DEFAULT true | 是否对客户可见 |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 更新时间 |

**关联关系**:
- 多对一 → `orders.id`
- 多对一 → `users.id` (production_manager_id)

---

### 6. notifications（通知表）✅

**状态**: 已在schema.sql中定义（2024年修复）

**用途**: 存储系统通知

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | SERIAL | PRIMARY KEY | 通知ID |
| user_id | INTEGER | NOT NULL, FK → users(id) | 用户ID |
| type | VARCHAR(20) | NOT NULL | 通知类型：'reminder', 'assignment' |
| title | VARCHAR(255) | NOT NULL | 通知标题 |
| content | TEXT | 可为空 | 通知内容 |
| related_id | INTEGER | 可为空 | 关联ID（订单ID或催货ID） |
| related_type | VARCHAR(20) | 可为空 | 关联类型：'order', 'reminder' |
| is_read | BOOLEAN | DEFAULT false | 是否已读 |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| read_at | TIMESTAMP | 可为空 | 已读时间 |

**关联关系**:
- 多对一 → `users.id`

---

### 7. system_configs（系统配置表）✅

**状态**: 已在schema.sql中定义（2024年修复）

**用途**: 存储系统动态配置（角色权限、订单类型、订单状态等）

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | SERIAL | PRIMARY KEY | 配置ID |
| config_key | VARCHAR(100) | NOT NULL | 配置键 |
| config_type | VARCHAR(50) | DEFAULT 'general' | 配置类型：general/order_options/permissions/assignment_rules |
| version | INTEGER | DEFAULT 1 | 配置版本号，递增 |
| config_value | JSONB | NOT NULL | 配置值（JSON格式） |
| description | TEXT | 可为空 | 配置描述 |
| metadata | JSONB | DEFAULT '{}' | 附加元信息（如标签、作用域等） |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 更新时间 |

**关联关系**: 无（通过事件驱动通知其它服务）

#### system_config_versions（配置历史表）

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | SERIAL | PRIMARY KEY | 记录ID |
| config_key | VARCHAR(100) | NOT NULL | 配置键 |
| config_type | VARCHAR(50) | NOT NULL | 配置类型 |
| version | INTEGER | NOT NULL | 版本号 |
| config_value | JSONB | NOT NULL | 保存当时的配置值 |
| description | TEXT | 可为空 | 描述 |
| metadata | JSONB | DEFAULT '{}' | 元信息 |
| updated_by | INTEGER | 可为空 | 操作人 |
| diff | JSONB | 可为空 | 与前一版本的 diff |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 变更时间 |

---

## 权限体系

### 角色定义

系统采用**基于角色的访问控制（RBAC）**，包含三种角色：

1. **admin（管理员）**
   - 拥有所有权限
   - 可以创建、编辑、删除订单
   - 可以分配订单给生产跟单
   - 可以管理用户和配置
   - 可以查看所有数据

2. **production_manager（生产跟单）**
   - 只能查看分配给自己的订单
   - 只能查看自己订单类型权限范围内的订单
   - 可以更新订单的特定字段（根据权限配置）：
     - `is_completed`（是否完成）
     - `can_ship`（是否可以出货）
     - `estimated_ship_date`（预计出货日期）
     - `notes`（备注）
   - 可以创建、更新、删除跟进记录
   - 不能修改订单状态、订单类型等核心字段

3. **customer（客户）**
   - 只能查看自己的订单
   - 可以提交客户订单编号
   - 可以创建催货记录
   - 可以查看标记为可见的跟进记录
   - 不能修改订单其他信息

### 权限实现机制

#### 1. 认证层（JWT）

- **位置**: `backend/src/middleware/auth.ts`
- **机制**: 
  - 使用JWT Token进行身份认证
  - Token包含：`userId`, `role`, `username`
  - Token有效期：7天（可配置）
  - 每次请求验证Token有效性
  - 验证用户是否被禁用（`is_active`）

#### 2. 权限检查层

- **位置**: `backend/src/utils/permissionCheck.ts` + `backend/src/services/permissionService.ts`
- **机制**:
  - **权限服务层**（`permissionService.ts`）：集中管理所有权限检查逻辑
    - `canAccessOrder`: 检查订单访问权限
    - `canCreateOrder`: 检查订单创建权限
    - `canUpdateOrder`: 检查订单更新权限
    - `canUpdateOrderFieldByRole`: 检查字段更新权限
    - `canDeleteOrder`: 检查订单删除权限
    - `canCreateFollowUp`: 检查跟进记录创建权限
    - `canAccessFollowUp`: 检查跟进记录访问权限
    - `canCreateReminder`: 检查催货记录创建权限
    - `canRespondReminder`: 检查催货回复权限
    - `buildOrderDataAccessFilter`: 构建数据访问过滤器（实现数据隔离）
  - **权限工具层**（`permissionCheck.ts`）：
    - 从`system_configs`表读取权限配置（`role_permissions`）
    - 支持字段级权限控制（`canUpdateOrderField`）
    - 如果配置表不存在或配置缺失，使用默认权限（硬编码）
    - 权限配置格式：
      ```json
      {
        "production_manager": {
          "orders": {
            "can_view_assigned": true,
            "can_update_completed": true,
            "can_update_can_ship": true,
            "can_update_estimated_ship_date": true,
            "can_update_notes": true,
            "can_update_status": false,
            "can_update_order_type": false,
            "can_view_internal_notes": false
          }
        }
      }
      ```

#### 3. 中间件层

- **位置**: `backend/src/middleware/auth.ts`
- **中间件**:
  - `authenticateToken`: 验证JWT Token
  - `requireAdmin`: 要求管理员权限
  - `requireCustomer`: 要求客户权限

#### 4. 数据访问层

- **位置**: 各Controller中
- **机制**:
  - 在查询时根据角色过滤数据
  - 客户只能看到自己的订单（`WHERE customer_id = $userId`）
  - 生产跟单只能看到分配的订单（`WHERE assigned_to = $userId`）
  - 管理员可以看到所有数据

#### 5. 前端路由守卫

- **位置**: `frontend/src/router/index.ts`
- **机制**:
  - 使用Vue Router的`beforeEach`守卫
  - 检查`requiresAuth`、`requiresAdmin`、`requiresProduction`元信息
  - 未认证用户重定向到登录页
  - 权限不足用户重定向到首页

### 权限配置管理

- **位置**: `backend/src/services/configService.ts`
- **特性**:
  - 配置存储在`system_configs`表
  - 支持5分钟缓存（减少数据库查询）
  - 支持默认配置（向后兼容）
  - 配置变更后自动清除缓存

#### 角色权限配置实时生效流程

1. 管理员在配置中心更新 `role_permissions`（`configController` → `configService`）  
2. `configService` 写库后发布 `RolePermissionChanged` 事件（`events/configEvents.ts`），并附带 `updatedAt`  
3. `rolePermissionService.ts` 订阅事件，刷新缓存、通知监听者，并指示 `permissionCheck` 使用最新矩阵  
4. `permissionCheck.ts` 在每次权限判断时优先读取 `rolePermissionService` 缓存；缓存过期再回源 `system_configs`  
5. `/api/configs/role-permissions` 管理接口（返回矩阵+时间戳）供前端和其它模块拉取并比对版本  
6. **订单类型权限语义**：`assigned_order_types` 为空/NULL 代表可处理所有订单类型；仅当数组非空时才执行类型校验  
7. **角色 vs 用户覆盖**：若 `users.permission_overrides.orders.allowed_order_types` 存在，则优先采用用户覆盖；否则 fallback 到角色策略；若两者都为空，则视为无限制（详见 ADR-004）

#### 用户权限覆盖服务

- **位置**: `backend/src/services/userPermissionOverrideService.ts`  
- **职责**: 
  - 提供 `getUserPermissionOverrides`、`setUserPermissionOverrides`、`clearUserPermissionOverrideCache`  
  - 维护 60s 本地缓存，订阅 `UserPermissionOverrideChanged` 事件即时失效  
  - 通过 `permissionService` 合成最终权限（角色策略 → 用户覆盖）  
- **事件**: `permission.userOverrideChanged`（payload: `userId`, `overrides`, `updatedBy`, `source`, `version`, `timestamp`）

---

## 核心业务流程时序描述

### 流程1: 业务员下单 → 跟单员跟进 → 车间汇报 → 出货

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ 业务员  │    │ 管理员  │    │生产跟单 │    │  车间   │    │  客户   │
│(Admin)  │    │(Admin)  │    │(Manager)│    │(外部)   │    │(Customer)│
└────┬────┘    └────┬────┘    └────┬────┘    └────┬────┘    └────┬────┘
     │              │              │              │              │
     │ 1.创建订单   │              │              │              │
     │─────────────>│              │              │              │
     │              │              │              │              │
     │              │ 2.分配订单   │              │              │
     │              │─────────────>│              │              │
     │              │              │              │              │
     │              │              │ 3.创建跟进记录│              │
     │              │              │─────────────>│              │
     │              │              │              │              │
     │              │              │ 4.更新订单状态│              │
     │              │              │ (is_completed)│              │
     │              │              │─────────────>│              │
     │              │              │              │              │
     │              │              │ 5.标记可出货  │              │
     │              │              │ (can_ship=true)│              │
     │              │              │─────────────>│              │
     │              │              │              │              │
     │              │              │ 6.更新预计出货日期│          │
     │              │              │─────────────>│              │
     │              │              │              │              │
     │              │              │ 7.创建跟进记录(对客户可见)│
     │              │              │────────────────────────────>│
     │              │              │              │              │
     │              │ 8.标记订单为已发货│          │              │
     │              │─────────────>│              │              │
     │              │              │              │              │
     │              │              │              │              │
```

**详细步骤**:

1. **业务员创建订单**
   - 管理员登录系统
   - 填写订单信息（订单编号、客户、订单类型、下单时间等）
   - 系统创建订单，状态为`pending`
   - 记录到`order_status_history`

2. **管理员分配订单**
   - 管理员选择订单
   - 分配给生产跟单（验证订单类型权限）
   - 订单状态变为`assigned`
   - 发送通知给生产跟单

3. **生产跟单创建跟进记录**
   - 生产跟单登录系统
   - 查看分配给自己的订单
   - 创建跟进记录（`order_follow_ups`）
   - 可选择是否对客户可见

4. **车间汇报进度**
   - 生产跟单根据车间反馈更新订单
   - 更新`is_completed`（是否完成）
   - 更新`can_ship`（是否可以出货）
   - 更新`estimated_ship_date`（预计出货日期）
   - 更新`notes`（备注）

5. **通知客户**
   - 如果跟进记录标记为对客户可见
   - 系统发送通知给客户
   - 客户可以看到订单进度

6. **出货**
   - 管理员标记订单为`shipped`
   - 填写实际出货日期（`actual_ship_date`）
   - 填写发货单号（`shipping_tracking_numbers`）

### 流程2: 客户催货流程

```
┌─────────┐    ┌─────────┐    ┌─────────┐
│  客户   │    │ 管理员  │    │生产跟单 │
│(Customer)│    │(Admin)  │    │(Manager)│
└────┬────┘    └────┬────┘    └────┬────┘
     │              │              │
     │ 1.创建催货记录│              │
     │─────────────>│              │
     │              │              │
     │              │ 2.分配催货任务│
     │              │─────────────>│
     │              │              │
     │              │              │ 3.处理催货
     │              │              │ (更新订单/回复)│
     │              │<─────────────│
     │              │              │
     │ 4.管理员回复  │              │
     │<─────────────│              │
     │              │              │
```

**详细步骤**:

1. **客户创建催货记录**
   - 客户登录系统
   - 选择订单
   - 创建催货记录（`delivery_reminders`）
   - 选择催货类型（普通/紧急）

2. **管理员分配催货任务**
   - 管理员查看催货记录
   - 分配给生产跟单
   - 发送通知

3. **生产跟单处理**
   - 查看催货记录
   - 更新订单状态或创建跟进记录
   - 标记催货为已解决

4. **管理员回复客户**
   - 管理员查看催货记录
   - 填写回复（`admin_response`）
   - 客户可以看到回复

---

## 架构坏味道和潜在风险

### 🔴 严重问题（必须立即修复）

1. **数据库表定义缺失** ✅ **已修复**
   - **问题**: `order_follow_ups`、`notifications`、`system_configs`表在代码中使用，但未在`schema.sql`中定义
   - **影响**: 新环境部署时数据库结构不完整，系统无法正常运行
   - **位置**: `database/schema.sql`
   - **风险等级**: 🔴 严重
   - **修复状态**: ✅ 已在schema.sql中补充表定义，并创建迁移脚本`009_add_missing_tables.sql`

2. **订单状态值散落在多个文件** ✅ **已修复**
   - **问题**: 订单状态值（pending, in_production, completed等）在以下位置重复定义：
     - `backend/src/services/configService.ts` (默认配置)
     - `backend/src/controllers/orderController.ts` (硬编码)
     - `frontend/src/composables/useConfigOptions.ts` (前端)
   - **影响**: 状态值变更需要修改多处，容易遗漏，导致前后端不一致
   - **风险等级**: 🔴 严重
   - **修复状态**: ✅ 已创建常量模块 `backend/src/constants/orderStatus.ts` 和 `orderType.ts`，以及前端对应模块，所有硬编码已替换为常量引用

3. **权限判断逻辑重复** ✅ **已修复**
   - **问题**: 权限检查逻辑在多个Controller中重复实现：
     - `orderController.ts` 中3个角色分别写查询逻辑（约300行）
     - `followUpController.ts` 中重复权限检查
     - `reminderController.ts` 中重复权限检查
   - **影响**: 权限逻辑变更需要修改多处，容易产生安全漏洞
   - **风险等级**: 🔴 严重
   - **修复状态**: ✅ 已创建权限服务层 `backend/src/services/permissionService.ts`，集中所有权限检查逻辑。已重构 `orderController.ts`、`followUpController.ts`、`reminderController.ts` 使用权限服务

4. **缺少审计日志**
   - **问题**: 系统没有完整的操作审计日志
   - **影响**: 无法追踪谁在什么时候做了什么操作，安全审计困难
   - **风险等级**: 🔴 严重

5. **订单控制器过大（1268行）** ✅ **已修复**
   - **问题**: `orderController.ts` 文件过大，包含12个函数，职责不清
   - **影响**: 难以维护、测试困难、代码复用性差
   - **风险等级**: 🔴 严重
   - **修复状态**: ✅ 已拆分为5个控制器文件：
     - `orderQueryController.ts` - 查询相关（getOrders, getOrderById, getOrderStatusHistory, getCustomers, getProductionManagers）
     - `orderCreateController.ts` - 创建相关（createOrder）
     - `orderUpdateController.ts` - 更新相关（updateOrder, completeOrder, updateCustomerOrderNumber）
     - `orderAssignController.ts` - 分配相关（assignOrderToProductionManager）
     - `orderDeleteController.ts` - 删除相关（deleteOrder）

### 🟡 中等问题（需要尽快优化）

6. **SQL注入风险（部分场景）**
   - **问题**: 虽然使用了参数化查询，但在动态构建WHERE子句时，字符串拼接存在风险
   - **位置**: `orderController.ts` 的 `getOrders` 函数
   - **影响**: 虽然当前实现相对安全，但代码可读性差，容易引入漏洞
   - **风险等级**: 🟡 中等

7. **缺少输入验证** ✅ **已修复**
   - **问题**: 大部分API接口缺少输入验证（Zod已安装但未使用）
   - **影响**: 无效数据可能进入数据库，导致数据不一致
   - **风险等级**: 🟡 中等
   - **修复状态**: ✅ 已创建统一的验证模块：
     - `validators/` 目录包含所有验证 Schema（orderSchemas, reminderSchemas, followUpSchemas, authSchemas, userSchemas）
     - `middleware/validate.ts` 提供 `validateBody`, `validateQuery`, `validateParams` 中间件
     - 所有主要接口已添加验证（订单、催货、跟进、认证、用户）

8. **错误处理不统一** ✅ **已修复**
   - **问题**: 错误处理逻辑分散，有些地方只记录日志，有些地方返回错误
   - **影响**: 用户体验不一致，调试困难
   - **风险等级**: 🟡 中等
   - **修复状态**: ✅ 已创建统一的错误处理模块：
     - `errors/AppError.ts` - 自定义错误类和错误工厂
     - `errors/errorHandler.ts` - 全局错误处理中间件和工具函数
     - 统一的错误响应格式（包含 error, errorCode, details, timestamp, path）
     - 统一的错误日志记录（区分可操作错误和系统错误）
     - 支持数据库错误自动转换（唯一约束、外键约束等）
     - 提供 `asyncHandler` 包装器用于自动捕获异步错误

9. **配置变更不立即生效** ✅ **已修复**
   - **问题**: 管理员调整系统配置后，API 与权限模块仍使用旧数据，需要等待缓存TTL
   - **影响**: 配置、角色权限、下拉选项无法即时生效，影响运维效率
   - **风险等级**: 🟡 中等
   - **修复状态**: ✅ 构建事件总线(`events/`)，配置更新触发 `ConfigUpdated`/`RolePermissionChanged` 事件，服务监听后即时清理缓存并推送最新配置

10. **数据库连接池配置不当**
    - **问题**: 连接池最大连接数20，但没有监控和告警
    - **影响**: 高并发时可能连接池耗尽，系统崩溃
    - **风险等级**: 🟡 中等

11. **缺少事务管理**
    - **问题**: 部分需要事务的操作没有使用事务（如订单删除）
    - **位置**: `orderController.ts` 的 `deleteOrder` 函数使用了事务，但其他更新操作没有
    - **影响**: 数据一致性风险
    - **风险等级**: 🟡 中等
12. **配置服务缓存策略简单**
    - **问题**: 配置服务使用5分钟固定TTL缓存，配置变更后需要等待缓存过期
    - **影响**: 配置变更不及时生效
    - **风险等级**: 🟡 中等

13. **前端状态管理混乱**
    - **问题**: 前端状态管理分散在多个Store中，部分数据在组件中直接管理
    - **影响**: 状态同步困难，容易出现数据不一致
    - **风险等级**: 🟡 中等

### 🟢 轻微问题（可以逐步优化）

14. **缺少API文档**
    - **问题**: 没有Swagger/OpenAPI文档
    - **影响**: 前后端协作效率低，接口理解困难
    - **风险等级**: 🟢 轻微

15. **缺少单元测试**
    - **问题**: 没有单元测试和集成测试
    - **影响**: 重构风险高，回归测试困难
    - **风险等级**: 🟢 轻微

16. **日志系统不完善**
    - **问题**: 只使用console.log，没有结构化日志
    - **影响**: 生产环境日志分析困难
    - **风险等级**: 🟢 轻微

17. **环境变量管理混乱**
    - **问题**: 环境变量散落在多个地方，没有统一管理
    - **影响**: 配置管理困难
    - **风险等级**: 🟢 轻微

18. **缺少数据备份策略**
    - **问题**: 没有自动备份机制
    - **影响**: 数据丢失风险
    - **风险等级**: 🟢 轻微

19. **前端组件过大**
    - **问题**: 部分Vue组件代码量过大（如OrderList.vue）
    - **影响**: 维护困难
    - **风险等级**: 🟢 轻微

20. **缺少性能监控**
    - **问题**: 没有APM（应用性能监控）
    - **影响**: 性能问题难以发现和定位
    - **风险等级**: 🟢 轻微

21. **OSS服务缺少错误重试**
    - **问题**: OSS上传失败没有重试机制
    - **影响**: 网络波动时上传失败
    - **风险等级**: 🟢 轻微

---

## 总结

当前系统采用**前后端分离架构**，使用**Vue3 + Express + PostgreSQL**技术栈，整体架构清晰，但存在以下主要问题：

1. **数据库表定义不完整**（严重）
2. **代码重复和职责不清**（严重）
3. **缺少审计和安全机制**（严重）
4. **缺少测试和文档**（轻微）

建议按照后续的架构演进路线图逐步优化。

---

**文档维护**: 本文档应随架构变更及时更新。

