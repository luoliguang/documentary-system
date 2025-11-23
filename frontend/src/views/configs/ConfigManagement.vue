<template>
  <div class="config-management">
    <el-card>
      <template #header>
        <div class="card-header">
          <h3>系统配置管理</h3>
        </div>
      </template>

      <el-tabs
        v-model="activeTab"
        :type="isMobile ? 'card' : 'border-card'"
        class="config-tabs"
      >
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
        
        <el-tab-pane label="通用配置" name="general">
          <GeneralConfigManagement />
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
// @ts-ignore - Vue SFC with script setup
import RoleManagement from './components/RoleManagement.vue';
// @ts-ignore - Vue SFC with script setup
import OrderTypeManagement from './components/OrderTypeManagement.vue';
// @ts-ignore - Vue SFC with script setup
import OrderStatusManagement from './components/OrderStatusManagement.vue';
// @ts-ignore - Vue SFC with script setup
import PermissionManagement from './components/PermissionManagement.vue';
// @ts-ignore - Vue SFC with script setup
import GeneralConfigManagement from './components/GeneralConfigManagement.vue';

const activeTab = ref('roles');
const isMobile = computed(() => window.innerWidth <= 768);
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

@media (max-width: 768px) {
  .config-management {
    padding: 10px;
  }

  .config-tabs :deep(.el-tabs__header) {
    margin: 0;
  }

  .config-tabs :deep(.el-tabs__item) {
    padding: 12px 16px;
    font-size: 14px;
  }

  .config-tabs :deep(.el-tabs__content) {
    padding: 10px;
  }
}
</style>

