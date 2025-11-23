<template>
  <div class="order-feedback-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <h3>{{ authStore.isCustomer ? '我的反馈' : '订单编号反馈管理' }}</h3>
        </div>
      </template>

      <!-- 筛选条件 -->
      <div class="filters">
        <el-form :inline="!isMobile" :model="filters" class="filter-form">
          <el-form-item label="状态">
            <el-select
              v-model="filters.status"
              placeholder="全部"
              clearable
              class="filter-select"
            >
              <el-option label="待处理" value="pending" />
              <el-option label="已处理" value="resolved" />
              <el-option label="已关闭" value="closed" />
            </el-select>
          </el-form-item>
          <el-form-item :label="authStore.isCustomer ? '订单编号' : '客户订单编号'">
            <el-input
              v-model="filters.customer_order_number"
              :placeholder="authStore.isCustomer ? '输入订单编号' : '输入客户订单编号'"
              clearable
              class="filter-input"
              @keyup.enter="loadFeedbacks"
            />
          </el-form-item>
          <el-form-item v-if="authStore.canManageOrders" label="客户公司">
            <el-select
              v-model="filters.company_name"
              placeholder="请选择客户公司"
              filterable
              clearable
              class="filter-select"
              style="width: 200px;"
            >
              <el-option
                v-for="company in companyNames"
                :key="company"
                :label="company"
                :value="company"
              />
            </el-select>
          </el-form-item>
          <el-form-item class="filter-buttons">
            <el-button type="primary" @click="loadFeedbacks">查询</el-button>
            <el-button @click="resetFilters">重置</el-button>
          </el-form-item>
        </el-form>
      </div>

      <!-- 桌面端：表格 -->
      <el-table
        v-if="!isMobile"
        v-loading="loading"
        :data="feedbacks"
        stripe
        style="width: 100%"
        class="desktop-table"
      >
        <el-table-column 
          prop="customer_order_number" 
          :label="authStore.isCustomer ? '订单编号' : '客户订单编号'" 
          width="180" 
        />
        <el-table-column prop="customer_company_name" label="客户公司" width="200" />
        <el-table-column prop="message" label="说明信息" min-width="200" show-overflow-tooltip />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag
              :type="
                row.status === 'pending'
                  ? 'warning'
                  : row.status === 'resolved'
                  ? 'success'
                  : 'info'
              "
            >
              {{
                row.status === 'pending'
                  ? '待处理'
                  : row.status === 'resolved'
                  ? '已处理'
                  : '已关闭'
              }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="提交时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column prop="resolver_username" label="处理人" width="120" />
        <el-table-column label="操作" width="250" fixed="right">
          <template #default="{ row }">
            <div class="action-buttons">
              <el-button
                v-if="row.status === 'pending' && authStore.canManageOrders"
                type="primary"
                size="small"
                @click="handleCreateOrder(row)"
              >
                创建订单
              </el-button>
              <el-button
                v-if="row.status === 'pending' && authStore.canManageOrders"
                type="success"
                size="small"
                @click="handleResolve(row)"
              >
                标记已处理
              </el-button>
              <el-button
                type="info"
                size="small"
                @click="handleViewDetail(row)"
              >
                查看详情
              </el-button>
              <el-button
                type="danger"
                size="small"
                @click="handleDelete(row)"
              >
                删除
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <!-- 手机端：卡片列表 -->
      <div v-else v-loading="loading" class="mobile-feedback-list">
        <transition-group name="feedback-card" tag="div">
          <el-card
            v-for="feedback in feedbacks"
            :key="feedback.id"
            class="feedback-card"
            shadow="hover"
          >
            <div class="feedback-card-header">
              <div class="feedback-info">
                <div class="feedback-number">{{ feedback.customer_order_number }}</div>
                <el-tag
                  :type="
                    feedback.status === 'pending'
                      ? 'warning'
                      : feedback.status === 'resolved'
                      ? 'success'
                      : 'info'
                  "
                  size="small"
                >
                  {{
                    feedback.status === 'pending'
                      ? '待处理'
                      : feedback.status === 'resolved'
                      ? '已处理'
                      : '已关闭'
                  }}
                </el-tag>
              </div>
            </div>
            <div class="feedback-card-body">
              <div v-if="feedback.customer_company_name" class="feedback-field">
                <span class="field-label">客户：</span>
                <span class="field-value">{{ feedback.customer_company_name }}</span>
              </div>
              <div v-if="feedback.message" class="feedback-field">
                <span class="field-label">说明：</span>
                <span class="field-value">{{ feedback.message }}</span>
              </div>
              <div class="feedback-field">
                <span class="field-label">提交时间：</span>
                <span class="field-value">{{ formatDate(feedback.created_at) }}</span>
              </div>
              <div v-if="feedback.resolver_username" class="feedback-field">
                <span class="field-label">处理人：</span>
                <span class="field-value">{{ feedback.resolver_username }}</span>
              </div>
            </div>
            <div class="feedback-card-actions">
              <el-button
                v-if="feedback.status === 'pending' && authStore.canManageOrders"
                type="primary"
                size="small"
                @click="handleCreateOrder(feedback)"
              >
                创建订单
              </el-button>
              <el-button
                v-if="feedback.status === 'pending' && authStore.canManageOrders"
                type="success"
                size="small"
                @click="handleResolve(feedback)"
              >
                标记已处理
              </el-button>
              <el-button
                type="info"
                size="small"
                @click="handleViewDetail(feedback)"
              >
                查看详情
              </el-button>
              <el-button
                type="danger"
                size="small"
                @click="handleDelete(feedback)"
              >
                删除
              </el-button>
            </div>
          </el-card>
        </transition-group>
      </div>

      <!-- 分页 -->
      <div class="pagination">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <!-- 处理反馈对话框 -->
    <el-dialog
      v-model="resolveDialogVisible"
      title="处理反馈"
      :width="isMobile ? '95%' : '500px'"
    >
      <el-form :model="resolveForm" :label-width="isMobile ? '80px' : '100px'">
        <el-form-item label="处理备注">
          <el-input
            v-model="resolveForm.resolution_note"
            type="textarea"
            :rows="4"
            placeholder="请输入处理备注（可选）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="resolveDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="resolving" @click="submitResolve">
          确定
        </el-button>
      </template>
    </el-dialog>

    <!-- 详情对话框 -->
    <el-dialog
      v-model="detailDialogVisible"
      title="反馈详情"
      :width="isMobile ? '95%' : '600px'"
    >
      <el-descriptions v-if="currentFeedback" :column="1" border>
        <el-descriptions-item label="客户订单编号">
          {{ currentFeedback.customer_order_number }}
        </el-descriptions-item>
        <el-descriptions-item label="客户公司">
          {{ currentFeedback.customer_company_name || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="说明信息">
          {{ currentFeedback.message || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag
            :type="
              currentFeedback.status === 'pending'
                ? 'warning'
                : currentFeedback.status === 'resolved'
                ? 'success'
                : 'info'
            "
          >
            {{
              currentFeedback.status === 'pending'
                ? '待处理'
                : currentFeedback.status === 'resolved'
                ? '已处理'
                : '已关闭'
            }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="提交时间">
          {{ formatDate(currentFeedback.created_at) }}
        </el-descriptions-item>
        <el-descriptions-item v-if="currentFeedback.resolved_at" label="处理时间">
          {{ formatDate(currentFeedback.resolved_at) }}
        </el-descriptions-item>
        <el-descriptions-item v-if="currentFeedback.resolver_username" label="处理人">
          {{ currentFeedback.resolver_username }}
        </el-descriptions-item>
        <el-descriptions-item v-if="currentFeedback.resolution_note" label="处理备注">
          {{ currentFeedback.resolution_note }}
        </el-descriptions-item>
        <el-descriptions-item v-if="currentFeedback.related_order_number" label="关联订单">
          <el-button
            type="primary"
            link
            @click="$router.push(`/orders/${currentFeedback.related_order_id}`)"
          >
            {{ currentFeedback.related_order_number }}
          </el-button>
        </el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="detailDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useAuthStore } from '../../stores/auth';
import { orderFeedbacksApi, type OrderNumberFeedback } from '../../api/orderFeedbacks';
import { ordersApi } from '../../api/orders';

const router = useRouter();
const authStore = useAuthStore();
const loading = ref(false);
const feedbacks = ref<OrderNumberFeedback[]>([]);
const pagination = ref({
  total: 0,
  page: 1,
  pageSize: 20,
  totalPages: 0,
});

const isMobile = computed(() => window.innerWidth <= 768);
const currentPage = ref(1);
const pageSize = ref(20);

const filters = reactive({
  status: '' as '' | 'pending' | 'resolved' | 'closed',
  customer_order_number: '',
  company_name: '',
});

const resolveDialogVisible = ref(false);
const resolving = ref(false);
const currentFeedback = ref<OrderNumberFeedback | null>(null);
const resolveForm = reactive({
  resolution_note: '',
});

const detailDialogVisible = ref(false);
const companyNames = ref<string[]>([]);

const formatDate = (date: string) => {
  if (!date) return '-';
  return new Date(date).toLocaleString('zh-CN');
};

const loadFeedbacks = async () => {
  loading.value = true;
  try {
    const response = await orderFeedbacksApi.getFeedbacks({
      page: currentPage.value,
      pageSize: pageSize.value,
      status: filters.status || undefined,
      customer_order_number: filters.customer_order_number || undefined,
      customer_company_name: filters.company_name || undefined,
      // 如果是客户，只获取自己的反馈
      customer_id: authStore.isCustomer ? authStore.user?.id : undefined,
    });
    feedbacks.value = response.feedbacks;
    pagination.value = response.pagination;
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '加载反馈列表失败');
  } finally {
    loading.value = false;
  }
};

const resetFilters = () => {
  filters.status = '';
  filters.customer_order_number = '';
  filters.company_name = '';
  currentPage.value = 1;
  loadFeedbacks();
};

const handleCreateOrder = (feedback: OrderNumberFeedback) => {
  // 跳转到创建订单页面，预填客户订单编号
  router.push({
    path: '/orders/create',
    query: {
      customer_order_number: feedback.customer_order_number,
      from_feedback: feedback.id.toString(),
    },
  });
};

const handleResolve = (feedback: OrderNumberFeedback) => {
  currentFeedback.value = feedback;
  resolveForm.resolution_note = '';
  resolveDialogVisible.value = true;
};

const submitResolve = async () => {
  if (!currentFeedback.value) return;

  resolving.value = true;
  try {
    await orderFeedbacksApi.resolveFeedback(currentFeedback.value.id, {
      status: 'resolved',
      resolution_note: resolveForm.resolution_note || undefined,
    });
    ElMessage.success('反馈已标记为已处理');
    resolveDialogVisible.value = false;
    await loadFeedbacks();
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '处理失败');
  } finally {
    resolving.value = false;
  }
};

const handleViewDetail = (feedback: OrderNumberFeedback) => {
  currentFeedback.value = feedback;
  detailDialogVisible.value = true;
};

const handleDelete = async (feedback: OrderNumberFeedback) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除订单编号"${feedback.customer_order_number}"的反馈吗？此操作不可恢复！`,
      '确认删除',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'error',
      }
    );

    await orderFeedbacksApi.deleteFeedback(feedback.id);
    ElMessage.success('反馈已删除');
    await loadFeedbacks();
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.error || '删除失败');
    }
  }
};

const loadCompanyNames = async () => {
  if (!authStore.canManageOrders) return;
  
  try {
    const response = await ordersApi.getCustomers();
    const companies = new Set<string>();
    response.customers.forEach((customer: any) => {
      if (customer.company_name && customer.company_name.trim()) {
        companies.add(customer.company_name.trim());
      }
    });
    companyNames.value = Array.from(companies).sort();
  } catch (error) {
    console.error('加载客户公司列表失败:', error);
  }
};

const handleSizeChange = () => {
  currentPage.value = 1;
  loadFeedbacks();
};

const handlePageChange = () => {
  loadFeedbacks();
};

onMounted(() => {
  loadFeedbacks();
  loadCompanyNames();
});
</script>

<style scoped>
.order-feedback-list {
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

.filter-form {
  width: 100%;
}

.filter-input,
.filter-select {
  width: 200px;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

/* 桌面端表格显示 */
.desktop-table {
  display: block;
}

/* 操作按钮容器 */
.action-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
  align-content: flex-start;
  margin: 0;
  padding: 0;
}

/* 重置按钮的默认 margin，确保换行后从左侧对齐 */
/* Element Plus 默认会给相邻的按钮添加 margin-left，需要重置 */
.action-buttons :deep(.el-button) {
  margin: 0 !important;
}

.action-buttons :deep(.el-button + .el-button) {
  margin-left: 0 !important;
}

/* 手机端卡片列表 */
@media (max-width: 768px) {
  .desktop-table {
    display: none;
  }

  .filter-input,
  .filter-select {
    width: 100%;
  }

  .mobile-feedback-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .feedback-card {
    border-radius: 8px;
  }

  .feedback-card-header {
    margin-bottom: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid #e5e9f2;
  }

  .feedback-number {
    font-size: 16px;
    font-weight: 600;
    color: #1f2d3d;
    margin-bottom: 4px;
  }

  .feedback-card-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 12px;
  }

  .feedback-field {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 13px;
  }

  .field-label {
    color: #909399;
    min-width: 70px;
    flex-shrink: 0;
  }

  .field-value {
    color: #303133;
    flex: 1;
    word-break: break-word;
  }

  .feedback-card-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .feedback-card-actions .el-button {
    flex: 1;
    min-width: 0;
    min-height: 36px;
    font-size: 12px;
  }
}

/* 过渡动画 */
.feedback-card-enter-active,
.feedback-card-leave-active {
  transition: all 0.25s ease;
}

.feedback-card-enter-from,
.feedback-card-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>

