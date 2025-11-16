<template>
  <div class="config-management">
    <el-card>
      <template #header>
        <div class="card-header">
          <h3>系统配置管理</h3>
        </div>
      </template>

      <el-tabs v-model="activeTab" type="border-card">
        <el-tab-pane label="角色管理" name="roles">
          <RoleManagement />
        </el-tab-pane>
        
        <el-tab-pane label="订单类型管理" name="orderTypes">
          <OrderTypeManagement />
        </el-tab-pane>
        
        <el-tab-pane label="订单状态管理" name="orderStatuses">
          <OrderStatusManagement />
        </el-tab-pane>
        
        <el-tab-pane label="权限配置" name="permissions">
          <PermissionManagement />
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
// @ts-ignore - Vue SFC with script setup
import RoleManagement from './components/RoleManagement.vue';
// @ts-ignore - Vue SFC with script setup
import OrderTypeManagement from './components/OrderTypeManagement.vue';
// @ts-ignore - Vue SFC with script setup
import OrderStatusManagement from './components/OrderStatusManagement.vue';
// @ts-ignore - Vue SFC with script setup
import PermissionManagement from './components/PermissionManagement.vue';

const activeTab = ref('roles');
</script>

<style scoped>
.config-management {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header h3 {
  margin: 0;
}
</style>

