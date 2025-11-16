<template>
  <div class="permission-management">
    <div v-loading="loading" class="permission-content">
      <el-card v-for="(permissions, role) in rolePermissions" :key="role" class="role-card">
        <template #header>
          <div class="role-header">
            <h4>{{ getRoleLabel(role) }}</h4>
          </div>
        </template>

        <div v-for="(resourcePerms, resource) in permissions" :key="resource" class="resource-section">
          <h5>{{ getResourceLabel(resource) }}</h5>
          <div class="permissions-list">
            <el-checkbox
              v-for="(value, permission) in resourcePerms"
              :key="permission"
              v-model="rolePermissions[role][resource][permission]"
              :label="getPermissionLabel(permission)"
            />
          </div>
        </div>
      </el-card>

      <div class="actions">
        <el-button type="primary" @click="handleSave">保存权限配置</el-button>
        <el-button @click="loadPermissions">重置</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { configsApi } from '../../../api/configs';

const loading = ref(false);
const rolePermissions = ref<Record<string, any>>({});
const originalPermissions = ref<Record<string, any>>({});

const getRoleLabel = (role: string) => {
  const labels: Record<string, string> = {
    admin: '管理员',
    production_manager: '生产跟单',
    customer: '客户',
  };
  return labels[role] || role;
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

const loadPermissions = async () => {
  loading.value = true;
  try {
    const response = await configsApi.getConfigByKey('role_permissions');
    rolePermissions.value = JSON.parse(JSON.stringify(response.config || {}));
    originalPermissions.value = JSON.parse(JSON.stringify(response.config || {}));
  } catch (error) {
    ElMessage.error('加载权限配置失败');
  } finally {
    loading.value = false;
  }
};

const handleSave = async () => {
  loading.value = true;
  try {
    await configsApi.updateConfig('role_permissions', {
      config_value: rolePermissions.value,
    });
    originalPermissions.value = JSON.parse(JSON.stringify(rolePermissions.value));
    ElMessage.success('权限配置保存成功');
  } catch (error) {
    ElMessage.error('保存失败');
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadPermissions();
});
</script>

<style scoped>
.permission-management {
  padding: 20px 0;
}

.permission-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.role-card {
  margin-bottom: 20px;
}

.role-header h4 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
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

.actions {
  margin-top: 20px;
  text-align: right;
}
</style>

