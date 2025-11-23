<template>
  <div class="role-management">
    <div class="header-actions">
      <el-button type="primary" @click="handleCreate">
        <el-icon><Plus /></el-icon>
        创建角色
      </el-button>
      <el-button
        v-if="!hasCustomerServiceRole"
        type="success"
        @click="handleCreateCustomerService"
      >
        <el-icon><Plus /></el-icon>
        一键创建“客服”角色
      </el-button>
    </div>

    <!-- 桌面端：表格 -->
    <el-table
      v-if="!isMobile"
      v-loading="tableLoading"
      :data="roles"
      stripe
      style="width: 100%"
      class="desktop-table"
    >
      <el-table-column prop="value" label="角色值" width="150" />
      <el-table-column prop="label" label="角色名称" width="200" />
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" size="small" link @click="handleEdit(row)">
            编辑
          </el-button>
          <el-button type="danger" size="small" link @click="handleDelete(row)">
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 手机端：卡片列表 -->
    <div v-else v-loading="tableLoading" class="mobile-role-list">
      <transition-group name="role-card" tag="div">
        <el-card
          v-for="role in roles"
          :key="role.value"
          class="role-card"
          shadow="hover"
        >
          <div class="role-card-header">
            <div class="role-info">
              <div class="role-label">{{ role.label }}</div>
              <div class="role-value">{{ role.value }}</div>
            </div>
          </div>
          <div class="role-card-actions">
            <el-button type="primary" size="small" @click="handleEdit(role)">
              编辑
            </el-button>
            <el-button type="danger" size="small" @click="handleDelete(role)">
              删除
            </el-button>
          </div>
        </el-card>
      </transition-group>
    </div>

    <!-- 创建/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      :width="dialogWidth"
      class="role-edit-dialog"
    >
      <el-tabs v-model="activeTab">
        <el-tab-pane label="基本信息" name="basic">
          <el-form :model="form" :label-width="labelWidth">
            <el-form-item label="角色值" required>
              <el-input v-model="form.value" placeholder="如：admin" :disabled="isEdit" />
            </el-form-item>
            <el-form-item label="角色名称" required>
              <el-input v-model="form.label" placeholder="如：管理员" />
            </el-form-item>
          </el-form>
        </el-tab-pane>
        <el-tab-pane v-if="isEdit" label="权限配置" name="permissions">
          <div v-loading="permissionsLoading" class="permissions-content">
            <div v-for="(resourcePerms, resource) in rolePermissions" :key="resource" class="resource-section">
              <h5>{{ getResourceLabel(resource) }}</h5>
              <div class="permissions-list">
                <template
                  v-for="(_value, permission) in resourcePerms"
                  :key="String(permission)"
                >
                  <el-checkbox
                    v-if="String(permission) !== 'allowed_order_types'"
                    :model-value="rolePermissions[resource][String(permission)]"
                    @update:model-value="(val: boolean) => {
                      rolePermissions[resource][String(permission)] = val;
                    }"
                    :label="getPermissionLabel(String(permission))"
                  />
                </template>
              </div>
              <!-- 订单类型权限配置（仅当资源为 orders 时显示） -->
              <div v-if="resource === 'orders'" class="order-types-section">
                <h6>可操作的订单类型</h6>
                <el-checkbox-group
                  v-model="rolePermissions[resource].allowed_order_types"
                  class="order-types-checkbox-group"
                >
                  <el-checkbox
                    v-for="orderType in orderTypes"
                    :key="orderType.value"
                    :label="orderType.value"
                  >
                    {{ orderType.label }}
                  </el-checkbox>
                </el-checkbox-group>
                <p class="order-types-tip">
                  选择该角色可以查看和操作的订单类型。如果不选择任何类型，则默认可以操作所有类型。
                </p>
              </div>
            </div>
            <el-empty v-if="Object.keys(rolePermissions).length === 0" description="该角色暂无权限配置" />
          </div>
        </el-tab-pane>
      </el-tabs>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import { useConfigOptions } from '../../../composables/useConfigOptions';
import { useConfigStore } from '../../../stores/config';

const isMobile = computed(() => window.innerWidth <= 768);
const dialogWidth = computed(() => (isMobile.value ? '95%' : '800px'));
const labelWidth = computed(() => (isMobile.value ? '80px' : '100px'));

interface Role {
  value: string;
  label: string;
}

const ROLES_KEY = 'roles';
const ROLES_TYPE = 'general';
const ROLE_PERMISSIONS_KEY = 'role_permissions';
const ROLE_PERMISSIONS_TYPE = 'permissions';

const configStore = useConfigStore();
const CUSTOMER_SERVICE_ROLE_VALUE = 'customer_service';

const tableLoading = ref(false);
const roles = computed<Role[]>(() => {
  return configStore.getConfigValue<Role[]>(ROLES_KEY, ROLES_TYPE) || [];
});
const hasCustomerServiceRole = computed(() =>
  roles.value.some((role) => role.value === CUSTOMER_SERVICE_ROLE_VALUE)
);
const dialogVisible = ref(false);
const isEdit = ref(false);
const dialogTitle = ref('创建角色');
const activeTab = ref('basic');
const permissionsLoading = ref(false);
const rolePermissions = ref<Record<string, any>>({});
const allRolePermissions = ref<Record<string, any>>({});

// 配置选项
const { orderTypes, loadOrderTypes } = useConfigOptions();

const form = ref<Role>({
  value: '',
  label: '',
});

const createEmptyPermissionTemplate = () => ({
  orders: {
    can_view_all: false,
    can_view_assigned: false,
    can_view_own: false,
    can_create: false,
    can_update: false,
    can_delete: false,
    can_assign: false,
    can_update_completed: false,
    can_update_can_ship: false,
    can_update_estimated_ship_date: false,
    can_update_notes: false,
    can_update_status: false,
    can_update_order_type: false,
    can_view_internal_notes: false,
    allowed_order_types: [],
  },
  reminders: {
    can_view_all: false,
    can_view_assigned: false,
    can_create: false,
    can_update: false,
    can_delete: false,
  },
  users: {
    can_view: false,
    can_create: false,
    can_update: false,
    can_delete: false,
  },
  configs: {
    can_view: false,
    can_update: false,
  },
});

const buildDefaultPermissions = (roleValue: string) => {
  const template = createEmptyPermissionTemplate();
  if (roleValue === CUSTOMER_SERVICE_ROLE_VALUE) {
    template.orders = {
      ...template.orders,
      can_view_all: true,
      can_create: true,
      can_update: true,
      can_delete: true,
      can_assign: true,
      can_update_completed: true,
      can_update_can_ship: true,
      can_update_estimated_ship_date: true,
      can_update_notes: true,
      can_update_status: true,
      can_update_order_type: true,
      can_view_internal_notes: true,
      allowed_order_types: [],
    };
    template.reminders = {
      can_view_all: true,
      can_view_assigned: true,
      can_create: true,
      can_update: true,
      can_delete: true,
    };
    template.users = {
      can_view: true,
      can_create: true,
      can_update: true,
      can_delete: false,
    };
    template.configs = {
      can_view: false,
      can_update: false,
    };
  }
  return template;
};

const clone = (value: any) => JSON.parse(JSON.stringify(value));

const upsertRolePermissionEntry = async (
  roleValue: string,
  permissions?: Record<string, any>
) => {
  const existing =
    (await configStore.fetchConfig(ROLE_PERMISSIONS_KEY, {
      type: ROLE_PERMISSIONS_TYPE,
      force: true,
    })) || {};
  const nextPermissions = clone(existing);
  const payload = permissions ? clone(permissions) : buildDefaultPermissions(roleValue);
  if (!nextPermissions[roleValue] || permissions) {
    nextPermissions[roleValue] = payload;
    await configStore.saveConfig(ROLE_PERMISSIONS_KEY, nextPermissions, {
      type: ROLE_PERMISSIONS_TYPE,
    });
  }
};

const loadRoles = async () => {
  tableLoading.value = true;
  try {
    await configStore.fetchConfig(ROLES_KEY, { type: ROLES_TYPE, force: true });
  } catch (error) {
    ElMessage.error('加载角色列表失败');
  } finally {
    tableLoading.value = false;
  }
};

const handleCreate = () => {
  isEdit.value = false;
  dialogTitle.value = '创建角色';
  form.value = { value: '', label: '' };
  activeTab.value = 'basic';
  rolePermissions.value = {};
  dialogVisible.value = true;
};

const handleCreateCustomerService = () => {
  const exists = roles.value.some(
    (role) => role.value === CUSTOMER_SERVICE_ROLE_VALUE
  );
  if (exists) {
    ElMessage.info('“客服”角色已存在');
    return;
  }
  form.value = { value: CUSTOMER_SERVICE_ROLE_VALUE, label: '客服' };
  isEdit.value = false;
  activeTab.value = 'basic';
  rolePermissions.value = buildDefaultPermissions(CUSTOMER_SERVICE_ROLE_VALUE);
  dialogTitle.value = '创建客服角色';
  dialogVisible.value = true;
};

const getResourceLabel = (resource: string) => {
  const labels: Record<string, string> = {
    orders: '订单',
    reminders: '催货记录',
    users: '用户管理',
    configs: '系统配置',
  };
  return labels[resource] || resource;
};

const getPermissionLabel = (permission: string) => {
  const labels: Record<string, string> = {
    can_view_all: '查看全部',
    can_view_assigned: '查看分配的',
    can_view_own: '查看自己的',
    can_create: '创建',
    can_update: '更新',
    can_delete: '删除',
    can_update_completed: '更新完成状态',
    can_update_can_ship: '更新可出货状态',
    can_update_estimated_ship_date: '更新预计出货日期',
    can_update_notes: '更新备注',
    can_update_status: '更新状态',
    can_update_order_type: '更新订单类型',
    can_view_internal_notes: '查看内部备注',
    can_assign: '分配',
    can_view: '查看',
  };
  return labels[permission] || permission;
};

const loadRolePermissions = async (roleValue: string) => {
  if (!roleValue) {
    rolePermissions.value = {};
    return;
  }

  permissionsLoading.value = true;
  try {
    const data =
      (await configStore.fetchConfig(ROLE_PERMISSIONS_KEY, {
        type: ROLE_PERMISSIONS_TYPE,
      })) || {};
    
    // 确保 data 是对象类型
    const permissionsData = typeof data === 'object' && data !== null ? data : {};
    allRolePermissions.value = clone(permissionsData);

    const currentRolePermissions = allRolePermissions.value[roleValue];
    if (currentRolePermissions && typeof currentRolePermissions === 'object') {
      rolePermissions.value = clone(currentRolePermissions);
    } else {
      rolePermissions.value = buildDefaultPermissions(roleValue);
    }

    // 确保 orders 资源有 allowed_order_types 字段
    if (rolePermissions.value.orders && !rolePermissions.value.orders.allowed_order_types) {
      rolePermissions.value.orders.allowed_order_types = [];
    }
    
    // 确保所有资源都有正确的结构
    if (!rolePermissions.value.orders) {
      rolePermissions.value.orders = createEmptyPermissionTemplate().orders;
    }
    if (!rolePermissions.value.reminders) {
      rolePermissions.value.reminders = createEmptyPermissionTemplate().reminders;
    }
    if (!rolePermissions.value.users) {
      rolePermissions.value.users = createEmptyPermissionTemplate().users;
    }
    if (!rolePermissions.value.configs) {
      rolePermissions.value.configs = createEmptyPermissionTemplate().configs;
    }
  } catch (error) {
    console.error('加载权限配置失败:', error);
    ElMessage.error('加载权限配置失败');
    rolePermissions.value = buildDefaultPermissions(roleValue);
  } finally {
    permissionsLoading.value = false;
  }
};

const handleEdit = (row: Role) => {
  isEdit.value = true;
  dialogTitle.value = '编辑角色';
  form.value = { ...row };
  activeTab.value = 'basic';
  dialogVisible.value = true;
  // 加载该角色的权限配置
  loadRolePermissions(row.value);
};

// 监听对话框打开，如果是编辑模式且切换到权限标签页，加载权限
watch([dialogVisible, activeTab], ([visible, tab]) => {
  if (visible && isEdit.value && tab === 'permissions' && form.value.value) {
    if (Object.keys(rolePermissions.value).length === 0) {
      loadRolePermissions(form.value.value);
    }
    // 加载订单类型选项
    loadOrderTypes();
  }
});

const handleDelete = async (row: Role) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除角色"${row.label}"吗？删除后该角色的权限配置也将被清除。`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );

    // 1. 删除角色
    const updatedRoles = roles.value.filter((r) => r.value !== row.value);
    await configStore.saveConfig(ROLES_KEY, updatedRoles, { type: ROLES_TYPE });

    // 2. 删除该角色的权限配置
    try {
      const response =
        (await configStore.fetchConfig(ROLE_PERMISSIONS_KEY, {
          type: ROLE_PERMISSIONS_TYPE,
          force: true,
        })) || {};
      const currentPermissions = JSON.parse(JSON.stringify(response));
      if (currentPermissions[row.value]) {
        delete currentPermissions[row.value];
        await configStore.saveConfig(ROLE_PERMISSIONS_KEY, currentPermissions, {
          type: ROLE_PERMISSIONS_TYPE,
        });
      }
    } catch (error) {
      console.warn('删除角色权限配置失败:', error);
      // 权限删除失败不影响角色删除
    }

    ElMessage.success('删除成功');
    loadRoles();
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败');
    }
  }
};

const handleSubmit = async () => {
  if (!form.value.value || !form.value.label) {
    ElMessage.warning('请填写完整信息');
    return;
  }

  try {
    // 1. 更新角色列表
    let updatedRoles: Role[];
    if (isEdit.value) {
      updatedRoles = roles.value.map((r) =>
        r.value === form.value.value ? form.value : r
      );
    } else {
      if (roles.value.some((r) => r.value === form.value.value)) {
        ElMessage.error('角色值已存在');
        return;
      }
      updatedRoles = [...roles.value, form.value];
    }

    await configStore.saveConfig(ROLES_KEY, updatedRoles, { type: ROLES_TYPE });

    // 2. 同步权限配置
    if (isEdit.value && Object.keys(rolePermissions.value).length > 0) {
      await upsertRolePermissionEntry(
        form.value.value,
        rolePermissions.value
      );
    } else if (!isEdit.value) {
      await upsertRolePermissionEntry(form.value.value);
    }

    ElMessage.success(isEdit.value ? '更新成功' : '创建成功');
    dialogVisible.value = false;
    loadRoles();
  } catch (error) {
    ElMessage.error('操作失败');
  }
};

onMounted(() => {
  loadRoles();
  loadOrderTypes();
});
</script>

<style scoped>
.role-management {
  padding: 20px 0;
}

.header-actions {
  margin-bottom: 20px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.permissions-content {
  padding: 10px 0;
}

.resource-section {
  margin-bottom: 20px;
}

.resource-section h5 {
  margin: 0 0 10px 0;
  font-size: 16px;
  font-weight: 500;
  color: #606266;
}

.permissions-list {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  padding: 10px;
  background: #f5f7fa;
  border-radius: 4px;
}

.order-types-section {
  margin-top: 20px;
  padding: 15px;
  background: #fafafa;
  border-radius: 4px;
  border: 1px solid #e4e7ed;
}

.order-types-section h6 {
  margin: 0 0 10px 0;
  font-size: 14px;
  font-weight: 500;
  color: #606266;
}

.order-types-checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  margin-bottom: 10px;
}

.order-types-tip {
  margin: 10px 0 0 0;
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
}

@media (max-width: 768px) {
  .role-management {
    padding: 10px 0;
  }

  .header-actions {
    margin-bottom: 15px;
  }

  .header-actions .el-button {
    width: 100%;
    margin-bottom: 8px;
  }

  /* 表格转卡片 */
  .role-management :deep(.el-table) {
    display: none;
  }

  .mobile-role-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .role-card {
    border-radius: 8px;
    padding: 12px;
  }

  .role-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid #e5e9f2;
  }

  .role-value {
    font-size: 14px;
    color: #909399;
  }

  .role-label {
    font-size: 16px;
    font-weight: 600;
    color: #1f2d3d;
  }

  .role-card-actions {
    display: flex;
    gap: 8px;
    margin-top: 12px;
  }

  .role-card-actions .el-button {
    flex: 1;
    min-height: 36px;
  }

  /* 对话框优化 */
  .role-edit-dialog :deep(.el-dialog) {
    margin: 5vh auto !important;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
  }

  .role-edit-dialog :deep(.el-dialog__body) {
    flex: 1;
    overflow-y: auto;
    padding: 15px;
    -webkit-overflow-scrolling: touch;
  }

  .role-edit-dialog :deep(.el-form-item) {
    margin-bottom: 18px;
  }

  .role-edit-dialog :deep(.el-form-item__label) {
    font-size: 13px;
  }

  .permissions-content {
    padding: 5px 0;
  }

  .resource-section {
    margin-bottom: 15px;
  }

  .resource-section h5 {
    font-size: 15px;
    margin-bottom: 8px;
  }

  .permissions-list {
    gap: 10px;
    padding: 8px;
  }

  .order-types-section {
    margin-top: 15px;
    padding: 12px;
  }

  .order-types-checkbox-group {
    gap: 10px;
  }
}

@media (max-width: 480px) {
  .role-edit-dialog :deep(.el-dialog) {
    margin: 2vh auto !important;
    max-height: 96vh;
  }

  .role-edit-dialog :deep(.el-dialog__body) {
    padding: 12px;
  }
}
</style>

