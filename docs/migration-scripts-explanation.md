# 数据库迁移脚本说明

## 📋 脚本作用说明

### 1. `scripts/run-config-migration.js`
**作用**：执行系统配置相关的数据库迁移

**功能**：
- 创建或更新 `system_configs` 表
- 用于存储系统配置项（如催货间隔时间、默认分页大小等）
- 支持系统配置管理功能

**何时使用**：
- 首次部署系统时
- 需要添加新的系统配置项时
- 系统配置表结构发生变化时

---

### 2. `database/run-order-activities-migration.ps1`
**作用**：执行订单活动记录相关的数据库迁移

**功能**：
- 创建 `order_activities` 表
- 用于记录订单的所有操作历史（创建、更新、状态变更等）
- 支持订单活动时间线功能

**何时使用**：
- 首次部署系统时
- 需要启用订单活动记录功能时
- 订单活动表结构发生变化时

---

### 3. `scripts/run-order-feedback-migration.js` ⭐ **新添加**
**作用**：执行订单编号反馈功能的数据库迁移

**功能**：
- 创建 `order_number_feedbacks` 表
- 用于存储客户提交的"找不到订单编号"反馈
- 支持订单编号反馈管理功能

**何时使用**：
- 首次部署订单编号反馈功能时
- 需要启用订单编号反馈功能时

---

## 🚀 快速执行指南

### 执行订单编号反馈迁移（当前需要）

```bash
node scripts/run-order-feedback-migration.js
```

### 执行系统配置迁移

```bash
node scripts/run-config-migration.js
```

### 执行订单活动迁移（PowerShell）

```powershell
.\database\run-order-activities-migration.ps1
```

---

## 📁 文件结构

```
项目根目录/
├── scripts/
│   ├── run-config-migration.js          # 系统配置迁移脚本
│   └── run-order-feedback-migration.js   # 订单编号反馈迁移脚本
├── database/
│   ├── migrations/                      # SQL 迁移文件目录
│   │   ├── 1003_create_order_number_feedbacks.sql
│   │   └── ...
│   └── run-order-activities-migration.ps1  # 订单活动迁移脚本
└── backend/
    └── src/
        └── migration/                    # TypeORM 迁移文件（用于开发）
```

---

## ⚠️ 注意事项

1. **执行顺序**：通常按照迁移文件的编号顺序执行
2. **备份数据**：执行迁移前建议备份数据库
3. **环境变量**：确保 `backend/.env` 文件中的数据库配置正确
4. **权限**：确保数据库用户有创建表和索引的权限

---

## 🔍 验证迁移结果

迁移执行成功后，可以通过以下 SQL 验证：

```sql
-- 检查表是否存在
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'order_number_feedbacks';

-- 检查索引
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'order_number_feedbacks';
```

---

## 📝 迁移文件命名规范

- **SQL 迁移文件**：`数据库/migrations/编号_描述.sql`
  - 例如：`1003_create_order_number_feedbacks.sql`
  
- **TypeORM 迁移文件**：`backend/src/migration/编号-描述.ts`
  - 例如：`1003-CreateOrderNumberFeedbacks.ts`

---

## 🆘 常见问题

### Q: 迁移执行失败怎么办？
A: 检查：
1. 数据库连接配置是否正确
2. 数据库用户是否有足够权限
3. 表是否已存在（如果已存在，迁移会跳过）

### Q: 可以重复执行迁移吗？
A: 可以，迁移脚本使用了 `IF NOT EXISTS`，重复执行是安全的。

### Q: 如何回滚迁移？
A: 目前迁移脚本没有自动回滚功能，需要手动执行 DROP 语句。

