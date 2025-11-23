# 订单编号反馈功能规划

## 一、功能概述

当客户在催单时找不到自己的订单编号，可以提交反馈。客服或管理员看到反馈后，可以创建订单或处理反馈。

## 二、数据模型设计

### 数据库表：`order_number_feedbacks`

```sql
CREATE TABLE order_number_feedbacks (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_order_number VARCHAR(255) NOT NULL,  -- 客户提供的订单编号
  message TEXT,  -- 客户说明信息
  status VARCHAR(20) DEFAULT 'pending',  -- pending/resolved/closed
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP,
  resolved_by INTEGER REFERENCES users(id),  -- 处理人ID
  resolution_note TEXT,  -- 处理备注
  related_order_id INTEGER REFERENCES orders(id),  -- 关联的订单ID（如果已创建）
  deleted_at TIMESTAMP  -- 软删除
);

CREATE INDEX idx_feedback_customer ON order_number_feedbacks(customer_id);
CREATE INDEX idx_feedback_status ON order_number_feedbacks(status);
CREATE INDEX idx_feedback_created ON order_number_feedbacks(created_at DESC);
```

## 三、后端API设计

### 1. 创建反馈
- **POST** `/api/order-feedbacks`
- **权限**：客户
- **请求体**：
  ```json
  {
    "customer_order_number": "PO-2024-001",
    "message": "我在系统中找不到这个订单编号"
  }
  ```
- **响应**：
  ```json
  {
    "message": "反馈已提交",
    "feedback": { ... }
  }
  ```

### 2. 获取反馈列表
- **GET** `/api/order-feedbacks`
- **权限**：客户（只能看自己的）、客服/管理员（看全部）
- **查询参数**：
  - `page`, `pageSize`: 分页
  - `status`: 筛选状态（pending/resolved/closed）
  - `customer_id`: 筛选客户（仅管理员）
  - `start_date`, `end_date`: 时间范围

### 3. 处理反馈
- **PATCH** `/api/order-feedbacks/:id/resolve`
- **权限**：客服、管理员
- **请求体**：
  ```json
  {
    "status": "resolved",
    "resolution_note": "已创建订单",
    "related_order_id": 123  // 可选，如果创建了订单
  }
  ```

### 4. 删除反馈
- **DELETE** `/api/order-feedbacks/:id`
- **权限**：客户（只能删自己的）、管理员（可删全部）

## 四、前端功能设计

### 1. 催单页面添加反馈入口
- 在 `ReminderList.vue` 或订单列表页面添加"找不到订单编号？"按钮
- 点击后弹出反馈对话框

### 2. 反馈对话框组件
- `OrderNumberFeedbackDialog.vue`
- 表单字段：
  - 客户订单编号（必填）
  - 说明信息（可选）

### 3. 反馈管理页面
- 路由：`/order-feedbacks`（仅管理员/客服可见）
- 功能：
  - 列表展示所有待处理反馈
  - 筛选：状态、客户、时间
  - 操作：
    - 查看详情
    - 标记为已处理
    - 跳转到创建订单（预填客户编号）
    - 删除

### 4. 导航菜单
- 在系统配置菜单下添加"订单编号反馈"（仅管理员/客服可见）

## 五、工作流程

1. **客户提交反馈**
   - 客户在催单页面点击"找不到订单编号？"
   - 填写客户订单编号和说明
   - 提交反馈

2. **管理员/客服处理**
   - 在反馈管理页面查看待处理反馈
   - 选择处理方式：
     - 如果订单存在：标记为已处理，关联订单
     - 如果订单不存在：点击"创建订单"，预填客户编号
     - 其他情况：添加处理备注，标记为已处理

3. **通知机制**
   - 客户提交反馈后，通知管理员/客服
   - 反馈被处理后，通知客户

## 六、实现优先级

1. **Phase 1**：基础功能
   - 数据库迁移
   - 后端API（创建、查询、处理）
   - 前端反馈对话框
   - 催单页面添加入口

2. **Phase 2**：管理功能
   - 反馈管理页面
   - 筛选和搜索
   - 跳转到创建订单

3. **Phase 3**：优化
   - 通知机制
   - 统计信息
   - 移动端优化

