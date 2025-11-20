# ADR-004 用户权限覆盖策略

- **状态**: Proposed
- **日期**: 2025-11-19
- **决策人**: 首席架构师

## 背景

- 当前系统允许在两个入口调整权限：
  1. **配置中心 → 角色管理**：编辑角色级 `role_permissions`，包括订单类型 (`allowed_order_types`)。
  2. **用户管理 → 编辑生产跟单**：单独配置 `assigned_order_types`。
- 运行时权限校验仅读取 `users.assigned_order_types`，导致角色级配置无法作为默认值。
- Phase 2 目标是“事件驱动 + 可插拔模块”，需要明确权限策略合成模型并触发缓存刷新。

## 决策

1. **策略分层**：
   - **基础策略 (Role Policy)**：来自 `system_configs.role_permissions[role]`。
   - **用户覆盖 (User Override)**：来自 `users.permission_overrides`（新增字段，兼容旧的 `assigned_order_types`）。
   - **合成规则**：优先使用用户覆盖；若覆盖缺失，则 fallback 到角色策略；若两者均为空，则视为无限制。
2. **事件与缓存**：
   - 保持 `RolePermissionChanged` 事件；其 payload 增加 `version`、`changedBy`。
   - 新增 `UserPermissionOverrideChanged` 事件（payload：`userId`, `changes`, `updatedBy`, `version`），供权限服务和前端刷新缓存。
   - `rolePermissionService` 与 `userPermissionOverrideService` 维护各自 TTL 缓存，并在事件触发时立即失效。
3. **服务职责**：
   - `permissionService.getEffectivePermissions(userId, role)` 统一输出合成结果。
   - `getProductionManagerOrderTypes` 使用用户覆盖 → 角色策略 → 默认顺序。
4. **权限与审计**：
   - 新增权限位 `canManageRolePolicies`、`canManageUserOverrides`。
   - 所有策略/覆盖变更写入 `audit_logs`（后续实现）。

## 影响

- **数据库**：在 `users` 表中新增 `permission_overrides JSONB DEFAULT '{}'`（兼容旧字段）。
- **代码**：新增 `userPermissionOverrideService.ts`；扩展 `permissionService`, `rolePermissionService`, `configController`, `userController` 等。
- **前端**：`RoleManagement` 管理基础策略，`UserList` 增加“权限覆盖”面板；新增 `GET /users/:id/effective-permissions`.
- **文档**：`ARCHITECTURE.md` 补充“权限策略合成流程”；Roadmap Phase 2 标记完成。

## 备选方案

1. **仅保留用户级配置**：放弃角色策略，只允许逐个用户配置。缺点：维护成本高、缺乏全局视图。
2. **仅保留角色策略**：禁止用户级覆盖。缺点：无法处理临时或特殊权限需求。

最终选择“两层策略 + 合成”以兼顾灵活性与治理。

## 后续任务

- [ ] 数据迁移：新增 `users.permission_overrides`，并将现有 `assigned_order_types` 清洗进新字段。
- [ ] 实现 `userPermissionOverrideService` 与事件。
- [ ] 更新前端 UI 与文档。


