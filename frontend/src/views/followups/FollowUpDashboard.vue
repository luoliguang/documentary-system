<template>
  <div class="follow-up-dashboard">
    <el-card>
      <div class="dashboard-header">
        <div>
          <h3>跟进记录概览</h3>
          <p class="subtitle">查看当前负责订单的最新跟进情况</p>
        </div>
        <el-button type="primary" @click="loadSummaries" :loading="loading">
          刷新
        </el-button>
      </div>

      <el-table
        v-loading="loading"
        :data="summaries"
        border
        style="width: 100%"
      >
        <el-table-column prop="order_number" label="订单编号" width="180" />
        <el-table-column prop="customer_order_number" label="客户订单编号" width="180" />
        <el-table-column label="客户" min-width="160">
          <template #default="{ row }">
            <div>{{ row.company_name || '-' }}</div>
            <div class="sub-text">{{ row.contact_name || '' }}</div>
          </template>
        </el-table-column>
        <el-table-column label="订单状态" width="120">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="follow_up_count" label="跟进次数" width="120" />
        <el-table-column label="客户可见" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="row.has_customer_visible ? 'success' : 'info'">
              {{ row.has_customer_visible ? '有' : '无' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="最近跟进时间" width="200">
          <template #default="{ row }">
            {{ formatDateTime(row.last_follow_up_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" link @click="openOrder(row.order_id)">
              查看订单
            </el-button>
            <el-button type="success" size="small" link @click="openQuickAction(row.order_id)">
              快速跟进
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="pagination.totalPages > 1" class="pagination">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          :page-sizes="[10, 20, 50]"
          layout="total, prev, pager, next, sizes"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <OrderQuickAction
      v-model="quickActionVisible"
      :order-id="currentOrderId"
      @success="handleQuickActionSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { followUpsApi, type FollowUpSummary } from '../../api/followUps';
// @ts-ignore - Vue SFC with script setup
import OrderQuickAction from '../../components/OrderQuickAction.vue';

const summaries = ref<FollowUpSummary[]>([]);
const loading = ref(false);
const pagination = ref({
  total: 0,
  page: 1,
  pageSize: 20,
  totalPages: 0,
});

const quickActionVisible = ref(false);
const currentOrderId = ref<number | null>(null);
const router = useRouter();

const loadSummaries = async () => {
  loading.value = true;
  try {
    const response = await followUpsApi.getMyFollowUpSummary({
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
    });
    summaries.value = response.summaries;
    pagination.value = response.pagination;
  } catch (error) {
    ElMessage.error('加载跟进记录失败');
  } finally {
    loading.value = false;
  }
};

const handleSizeChange = (size: number) => {
  pagination.value.pageSize = size;
  pagination.value.page = 1;
  loadSummaries();
};

const handlePageChange = (page: number) => {
  pagination.value.page = page;
  loadSummaries();
};

const formatDateTime = (value: string | null) => {
  if (!value) {
    return '暂无记录';
  }
  return new Date(value).toLocaleString('zh-CN');
};

const getStatusType = (status: string) => {
  const map: Record<string, string> = {
    pending: 'info',
    assigned: 'warning',
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
    assigned: '已分配',
    in_production: '生产中',
    completed: '已完成',
    shipped: '已发货',
    cancelled: '已取消',
  };
  return map[status] || status || '-';
};

const openOrder = (orderId: number) => {
  router.push(`/orders/${orderId}`);
};

const openQuickAction = (orderId: number) => {
  currentOrderId.value = orderId;
  quickActionVisible.value = true;
};

const handleQuickActionSuccess = () => {
  quickActionVisible.value = false;
  loadSummaries();
};

onMounted(() => {
  loadSummaries();
});
</script>

<style scoped>
.follow-up-dashboard {
  padding: 20px;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.dashboard-header h3 {
  margin: 0;
}

.subtitle {
  margin: 4px 0 0;
  color: #909399;
  font-size: 13px;
}

.sub-text {
  color: #909399;
  font-size: 12px;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>

