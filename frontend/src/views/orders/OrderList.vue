<template>
  <div class="order-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <h3>订单列表</h3>
          <div class="header-actions">
            <el-button
              v-if="authStore.isAdmin"
              type="primary"
              @click="$router.push('/orders/create')"
            >
              创建订单
            </el-button>
          </div>
        </div>
      </template>

      <!-- 筛选条件 -->
      <div class="filters">
        <el-form :inline="true" :model="filters">
          <el-form-item label="订单状态">
            <el-select
              v-model="filters.status"
              placeholder="全部"
              clearable
              style="width: 150px"
            >
              <el-option label="待处理" value="pending" />
              <el-option label="生产中" value="in_production" />
              <el-option label="已完成" value="completed" />
              <el-option label="已发货" value="shipped" />
              <el-option label="已取消" value="cancelled" />
            </el-select>
          </el-form-item>
          <el-form-item label="是否完成">
            <el-select
              v-model="filters.is_completed"
              placeholder="全部"
              clearable
              style="width: 120px"
            >
              <el-option label="已完成" :value="true" />
              <el-option label="未完成" :value="false" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="loadOrders">查询</el-button>
            <el-button @click="resetFilters">重置</el-button>
          </el-form-item>
        </el-form>
      </div>

      <!-- 订单表格 -->
      <el-table
        v-loading="ordersStore.loading"
        :data="ordersStore.orders"
        stripe
        style="width: 100%"
      >
        <el-table-column prop="order_number" label="订单编号" width="180" />
        <el-table-column prop="customer_order_number" label="客户订单编号" width="180" />
        <el-table-column
          v-if="authStore.isAdmin"
          prop="company_name"
          label="客户公司"
          width="180"
        />
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="is_completed" label="是否完成" width="100">
          <template #default="{ row }">
            <el-tag :type="row.is_completed ? 'success' : 'info'">
              {{ row.is_completed ? '是' : '否' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="can_ship" label="可出货" width="100">
          <template #default="{ row }">
            <el-tag :type="row.can_ship ? 'success' : 'info'">
              {{ row.can_ship ? '是' : '否' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="estimated_ship_date" label="预计出货日期" width="140">
          <template #default="{ row }">
            {{ row.estimated_ship_date || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="notes" label="备注" min-width="200" show-overflow-tooltip />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button
              type="primary"
              size="small"
              link
              @click="viewOrder(row.id)"
            >
              查看
            </el-button>
            <el-button
              v-if="authStore.isAdmin && !row.is_completed"
              type="success"
              size="small"
              link
              @click="handleComplete(row.id)"
            >
              完成任务
            </el-button>
            <el-button
              v-if="authStore.isCustomer"
              type="warning"
              size="small"
              link
              @click="handleReminder(row.id)"
            >
              催货
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="ordersStore.pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <!-- 催货对话框 -->
    <ReminderDialog
      v-model="reminderDialogVisible"
      :order-id="selectedOrderId"
      @success="loadOrders"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useAuthStore } from '../../stores/auth';
import { useOrdersStore } from '../../stores/orders';
import ReminderDialog from '../../components/ReminderDialog.vue';

const router = useRouter();
const authStore = useAuthStore();
const ordersStore = useOrdersStore();

const filters = reactive({
  status: '',
  is_completed: undefined as boolean | undefined,
});

const currentPage = ref(1);
const pageSize = ref(20);
const reminderDialogVisible = ref(false);
const selectedOrderId = ref<number | null>(null);

const getStatusType = (status: string) => {
  const map: Record<string, string> = {
    pending: 'info',
    in_production: 'warning',
    completed: 'success',
    shipped: 'success',
    cancelled: 'danger',
  };
  return map[status] || 'info';
};

const getStatusText = (status: string) => {
  const map: Record<string, string> = {
    pending: '待处理',
    in_production: '生产中',
    completed: '已完成',
    shipped: '已发货',
    cancelled: '已取消',
  };
  return map[status] || status;
};

const loadOrders = async () => {
  try {
    await ordersStore.fetchOrders({
      page: currentPage.value,
      pageSize: pageSize.value,
      status: filters.status || undefined,
      is_completed: filters.is_completed,
    });
  } catch (error) {
    ElMessage.error('加载订单列表失败');
  }
};

const resetFilters = () => {
  filters.status = '';
  filters.is_completed = undefined;
  currentPage.value = 1;
  loadOrders();
};

const viewOrder = (id: number) => {
  router.push(`/orders/${id}`);
};

const handleComplete = async (id: number) => {
  try {
    await ElMessageBox.prompt('请输入完成备注（可选）', '完成任务', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputPlaceholder: '备注信息',
    });
    await ordersStore.completeOrder(id);
    ElMessage.success('订单已标记为完成');
    loadOrders();
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('操作失败');
    }
  }
};

const handleReminder = (orderId: number) => {
  selectedOrderId.value = orderId;
  reminderDialogVisible.value = true;
};

const handleSizeChange = () => {
  currentPage.value = 1;
  loadOrders();
};

const handlePageChange = () => {
  loadOrders();
};

onMounted(() => {
  loadOrders();
});
</script>

<style scoped>
.order-list {
  width: 100%;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.filters {
  margin-bottom: 20px;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>

