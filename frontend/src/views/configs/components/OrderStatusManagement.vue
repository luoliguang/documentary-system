<template>
  <div class="order-status-management">
    <div class="header-actions">
      <el-button type="primary" @click="handleCreate">
        <el-icon><Plus /></el-icon>
        创建订单状态
      </el-button>
    </div>

    <el-table v-loading="loading" :data="orderStatuses" stripe style="width: 100%">
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

    <!-- 创建/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="500px"
    >
      <el-form :model="form" label-width="100px">
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
</style>

