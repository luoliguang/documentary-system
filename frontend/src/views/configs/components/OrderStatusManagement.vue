<template>
  <div class="order-status-management">
    <div class="header-actions">
      <el-button type="primary" @click="handleCreate">
        <el-icon><Plus /></el-icon>
        创建订单状态
      </el-button>
    </div>

    <!-- 桌面端：表格 -->
    <el-table
      v-if="!isMobile"
      v-loading="loading"
      :data="orderStatuses"
      stripe
      style="width: 100%"
      class="desktop-table"
    >
      <el-table-column prop="value" label="状态值" width="150" />
      <el-table-column prop="label" label="状态名称" width="200" />
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
    <div v-else v-loading="loading" class="mobile-status-list">
      <transition-group name="status-card" tag="div">
        <el-card
          v-for="status in orderStatuses"
          :key="status.value"
          class="status-card"
          shadow="hover"
        >
          <div class="status-card-header">
            <div class="status-info">
              <div class="status-label">{{ status.label }}</div>
              <div class="status-value">{{ status.value }}</div>
            </div>
          </div>
          <div class="status-card-actions">
            <el-button type="primary" size="small" @click="handleEdit(status)">
              编辑
            </el-button>
            <el-button type="danger" size="small" @click="handleDelete(status)">
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
      class="status-edit-dialog"
    >
      <el-form :model="form" :label-width="labelWidth">
        <el-form-item label="状态值" required>
          <el-input v-model="form.value" placeholder="如：pending" :disabled="isEdit" />
        </el-form-item>
        <el-form-item label="状态名称" required>
          <el-input v-model="form.label" placeholder="如：待处理" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import { useConfigStore } from '../../../stores/config';
import { invalidateOrderStatusOptionsCache, setOrderStatusOptionsCache } from '../../../composables/useConfigOptions';

const isMobile = computed(() => window.innerWidth <= 768);
const dialogWidth = computed(() => (isMobile.value ? '95%' : '500px'));
const labelWidth = computed(() => (isMobile.value ? '80px' : '100px'));

interface OrderStatus {
  value: string;
  label: string;
}

const CONFIG_KEY = 'order_statuses';
const CONFIG_TYPE = 'order_options';

const configStore = useConfigStore();

const loading = computed(() =>
  configStore.isLoading(CONFIG_KEY, CONFIG_TYPE)
);
const orderStatuses = computed<OrderStatus[]>(() => {
  return (
    configStore.getConfigValue<OrderStatus[]>(CONFIG_KEY, CONFIG_TYPE) || []
  );
});
const dialogVisible = ref(false);
const isEdit = ref(false);
const dialogTitle = ref('创建订单状态');
const form = ref<OrderStatus>({
  value: '',
  label: '',
});

const loadOrderStatuses = async () => {
  try {
    await configStore.fetchConfig(CONFIG_KEY, { type: CONFIG_TYPE });
  } catch (error) {
    ElMessage.error('加载订单状态列表失败');
  }
};

const handleCreate = () => {
  isEdit.value = false;
  dialogTitle.value = '创建订单状态';
  form.value = { value: '', label: '' };
  dialogVisible.value = true;
};

const handleEdit = (row: OrderStatus) => {
  isEdit.value = true;
  dialogTitle.value = '编辑订单状态';
  form.value = { ...row };
  dialogVisible.value = true;
};

const handleDelete = async (row: OrderStatus) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除订单状态"${row.label}"吗？`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );

    const updatedStatuses = orderStatuses.value.filter((s) => s.value !== row.value);
    await configStore.saveConfig(CONFIG_KEY, updatedStatuses, { type: CONFIG_TYPE });
    invalidateOrderStatusOptionsCache();
    setOrderStatusOptionsCache(updatedStatuses);
    ElMessage.success('删除成功');
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
    let updatedStatuses: OrderStatus[];
    if (isEdit.value) {
      updatedStatuses = orderStatuses.value.map((s) =>
        s.value === form.value.value ? form.value : s
      );
    } else {
      if (orderStatuses.value.some((s) => s.value === form.value.value)) {
        ElMessage.error('状态值已存在');
        return;
      }
      updatedStatuses = [...orderStatuses.value, form.value];
    }

    await configStore.saveConfig(CONFIG_KEY, updatedStatuses, { type: CONFIG_TYPE });
    invalidateOrderStatusOptionsCache();
    setOrderStatusOptionsCache(updatedStatuses);
    ElMessage.success(isEdit.value ? '更新成功' : '创建成功');
    dialogVisible.value = false;
  } catch (error) {
    ElMessage.error('操作失败');
  }
};

onMounted(() => {
  loadOrderStatuses();
});
</script>

<style scoped>
.order-status-management {
  padding: 20px 0;
}

.header-actions {
  margin-bottom: 20px;
}

/* 桌面端表格显示 */
.desktop-table {
  display: block;
}

@media (max-width: 768px) {
  .desktop-table {
    display: none;
  }

  .order-status-management {
    padding: 10px 0;
  }

  .header-actions {
    margin-bottom: 15px;
  }

  .header-actions .el-button {
    width: 100%;
  }

  .mobile-status-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .status-card {
    border-radius: 8px;
  }

  .status-card-header {
    margin-bottom: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid #e5e9f2;
  }

  .status-label {
    font-size: 16px;
    font-weight: 600;
    color: #1f2d3d;
    margin-bottom: 4px;
  }

  .status-value {
    font-size: 13px;
    color: #909399;
  }

  .status-card-actions {
    display: flex;
    gap: 8px;
  }

  .status-card-actions .el-button {
    flex: 1;
    min-height: 36px;
  }

  /* 对话框优化 */
  .status-edit-dialog :deep(.el-dialog) {
    margin: 5vh auto !important;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
  }

  .status-edit-dialog :deep(.el-dialog__body) {
    flex: 1;
    overflow-y: auto;
    padding: 15px;
    -webkit-overflow-scrolling: touch;
  }

  .status-edit-dialog :deep(.el-form-item) {
    margin-bottom: 18px;
  }

  .status-edit-dialog :deep(.el-form-item__label) {
    font-size: 13px;
  }
}

@media (max-width: 480px) {
  .status-edit-dialog :deep(.el-dialog) {
    margin: 2vh auto !important;
    max-height: 96vh;
  }

  .status-edit-dialog :deep(.el-dialog__body) {
    padding: 12px;
  }
}

/* 过渡动画 */
.status-card-enter-active,
.status-card-leave-active {
  transition: all 0.25s ease;
}

.status-card-enter-from,
.status-card-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>

