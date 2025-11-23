<template>
  <div class="order-type-management">
    <div class="header-actions">
      <el-button type="primary" @click="handleCreate">
        <el-icon><Plus /></el-icon>
        创建订单类型
      </el-button>
    </div>

    <!-- 桌面端：表格 -->
    <el-table
      v-if="!isMobile"
      v-loading="loading"
      :data="orderTypes"
      stripe
      style="width: 100%"
      class="desktop-table"
    >
      <el-table-column prop="value" label="类型值" width="150" />
      <el-table-column prop="label" label="类型名称" width="200" />
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
    <div v-else v-loading="loading" class="mobile-type-list">
      <transition-group name="type-card" tag="div">
        <el-card
          v-for="type in orderTypes"
          :key="type.value"
          class="type-card"
          shadow="hover"
        >
          <div class="type-card-header">
            <div class="type-info">
              <div class="type-label">{{ type.label }}</div>
              <div class="type-value">{{ type.value }}</div>
            </div>
          </div>
          <div class="type-card-actions">
            <el-button type="primary" size="small" @click="handleEdit(type)">
              编辑
            </el-button>
            <el-button type="danger" size="small" @click="handleDelete(type)">
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
      class="type-edit-dialog"
    >
      <el-form :model="form" :label-width="labelWidth">
        <el-form-item label="类型值" required>
          <el-input v-model="form.value" placeholder="如：required" :disabled="isEdit" />
        </el-form-item>
        <el-form-item label="类型名称" required>
          <el-input v-model="form.label" placeholder="如：必发" />
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
import { invalidateOrderTypeOptionsCache, setOrderTypeOptionsCache } from '../../../composables/useConfigOptions';

const isMobile = computed(() => window.innerWidth <= 768);
const dialogWidth = computed(() => (isMobile.value ? '95%' : '500px'));
const labelWidth = computed(() => (isMobile.value ? '80px' : '100px'));

interface OrderType {
  value: string;
  label: string;
}

const CONFIG_KEY = 'order_types';
const CONFIG_TYPE = 'order_options';

const configStore = useConfigStore();

const loading = computed(() =>
  configStore.isLoading(CONFIG_KEY, CONFIG_TYPE)
);
const orderTypes = computed<OrderType[]>(() => {
  return (
    (configStore.getConfigValue<OrderType[]>(CONFIG_KEY, CONFIG_TYPE) as OrderType[]) ||
    []
  );
});
const dialogVisible = ref(false);
const isEdit = ref(false);
const dialogTitle = ref('创建订单类型');
const form = ref<OrderType>({
  value: '',
  label: '',
});

const loadOrderTypes = async () => {
  try {
    await configStore.fetchConfig(CONFIG_KEY, { type: CONFIG_TYPE });
  } catch (error) {
    ElMessage.error('加载订单类型列表失败');
  }
};

const handleCreate = () => {
  isEdit.value = false;
  dialogTitle.value = '创建订单类型';
  form.value = { value: '', label: '' };
  dialogVisible.value = true;
};

const handleEdit = (row: OrderType) => {
  isEdit.value = true;
  dialogTitle.value = '编辑订单类型';
  form.value = { ...row };
  dialogVisible.value = true;
};

const handleDelete = async (row: OrderType) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除订单类型"${row.label}"吗？`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );

    const updatedTypes = orderTypes.value.filter((t) => t.value !== row.value);
    await configStore.saveConfig(CONFIG_KEY, updatedTypes, { type: CONFIG_TYPE });
    invalidateOrderTypeOptionsCache();
    setOrderTypeOptionsCache(updatedTypes);
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
    let updatedTypes: OrderType[];
    if (isEdit.value) {
      updatedTypes = orderTypes.value.map((t) =>
        t.value === form.value.value ? form.value : t
      );
    } else {
      if (orderTypes.value.some((t) => t.value === form.value.value)) {
        ElMessage.error('类型值已存在');
        return;
      }
      updatedTypes = [...orderTypes.value, form.value];
    }

    await configStore.saveConfig(CONFIG_KEY, updatedTypes, { type: CONFIG_TYPE });
    invalidateOrderTypeOptionsCache();
    setOrderTypeOptionsCache(updatedTypes);
    ElMessage.success(isEdit.value ? '更新成功' : '创建成功');
    dialogVisible.value = false;
  } catch (error) {
    ElMessage.error('操作失败');
  }
};

onMounted(() => {
  loadOrderTypes();
});
</script>

<style scoped>
.order-type-management {
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

  .order-type-management {
    padding: 10px 0;
  }

  .header-actions {
    margin-bottom: 15px;
  }

  .header-actions .el-button {
    width: 100%;
  }

  .mobile-type-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .type-card {
    border-radius: 8px;
  }

  .type-card-header {
    margin-bottom: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid #e5e9f2;
  }

  .type-label {
    font-size: 16px;
    font-weight: 600;
    color: #1f2d3d;
    margin-bottom: 4px;
  }

  .type-value {
    font-size: 13px;
    color: #909399;
  }

  .type-card-actions {
    display: flex;
    gap: 8px;
  }

  .type-card-actions .el-button {
    flex: 1;
    min-height: 36px;
  }

  /* 对话框优化 */
  .type-edit-dialog :deep(.el-dialog) {
    margin: 5vh auto !important;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
  }

  .type-edit-dialog :deep(.el-dialog__body) {
    flex: 1;
    overflow-y: auto;
    padding: 15px;
    -webkit-overflow-scrolling: touch;
  }

  .type-edit-dialog :deep(.el-form-item) {
    margin-bottom: 18px;
  }

  .type-edit-dialog :deep(.el-form-item__label) {
    font-size: 13px;
  }
}

@media (max-width: 480px) {
  .type-edit-dialog :deep(.el-dialog) {
    margin: 2vh auto !important;
    max-height: 96vh;
  }

  .type-edit-dialog :deep(.el-dialog__body) {
    padding: 12px;
  }
}

/* 过渡动画 */
.type-card-enter-active,
.type-card-leave-active {
  transition: all 0.25s ease;
}

.type-card-enter-from,
.type-card-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>

