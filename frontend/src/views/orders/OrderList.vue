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
              size="default"
              class="create-btn"
              @click="$router.push('/orders/create')"
            >
              创建订单
            </el-button>
          </div>
        </div>
      </template>

      <!-- 筛选条件 -->
      <div class="filters">
        <el-form :inline="!isMobile" :model="filters" class="filter-form">
          <el-form-item label="工厂订单编号">
            <el-input
              v-model="filters.order_number"
              placeholder="输入工厂订单编号"
              clearable
              class="filter-input"
              @keyup.enter="loadOrders"
            />
          </el-form-item>
          <el-form-item label="客户订单编号">
            <el-input
              v-model="filters.customer_order_number"
              placeholder="输入客户订单编号"
              clearable
              class="filter-input"
              @keyup.enter="loadOrders"
            />
          </el-form-item>
          <el-form-item label="订单状态">
            <el-select
              v-model="filters.status"
              placeholder="全部"
              clearable
              class="filter-select"
              :key="`status-select-${orderStatuses.length}`"
            >
              <el-option label="全部" value="all" />
              <el-option
                v-for="status in orderStatuses"
                :key="status.value"
                :label="status.label"
                :value="status.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="是否完成">
            <el-select
              v-model="filters.is_completed"
              placeholder="全部"
              clearable
              class="filter-select"
              key="completed-select"
            >
              <el-option label="全部" value="all" />
              <el-option label="已完成" :value="true" />
              <el-option label="未完成" :value="false" />
            </el-select>
          </el-form-item>
          <el-form-item class="filter-buttons">
            <el-button type="primary" @click="loadOrders">查询</el-button>
            <el-button @click="resetFilters">重置</el-button>
          </el-form-item>
        </el-form>
      </div>

      <!-- 桌面端：订单表格 -->
      <el-table
        v-loading="ordersStore.loading"
        :data="ordersStore.orders"
        stripe
        class="desktop-table"
        style="width: 100%"
      >
        <el-table-column prop="order_number" label="工厂订单编号" width="180" />
        <el-table-column label="制单表" width="80" align="center">
          <template #default="{ row }">
            <el-image
              v-if="row.images && row.images.length > 0"
              :src="row.images[0]"
              :preview-src-list="row.images"
              :initial-index="0"
              fit="cover"
              class="order-thumbnail"
              :preview-teleported="true"
              lazy
            >
              <template #error>
                <div class="image-slot">
                  <el-icon><Picture /></el-icon>
                </div>
              </template>
            </el-image>
            <span v-else class="no-image">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="customer_order_number" label="客户订单编号" width="180" />
        <el-table-column
          v-if="authStore.isAdmin"
          prop="company_name"
          label="客户公司"
          width="180"
        />
        <el-table-column prop="status" label="状态" width="140">
          <template #default="{ row }">
            <el-select
              v-if="authStore.isAdmin"
              v-model="row.status"
              size="small"
              style="width: 100%"
              @change="handleStatusChange(row)"
            >
              <el-option
                v-for="status in orderStatuses"
                :key="status.value"
                :label="status.label"
                :value="status.value"
              />
            </el-select>
            <el-tag v-else :type="getStatusType(row.status)">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="is_completed" label="是否完成" width="100">
          <template #default="{ row }">
            <el-switch
              v-if="authStore.isAdmin || authStore.isProductionManager"
              v-model="row.is_completed"
              size="small"
              @change="handleIsCompletedChange(row)"
            />
            <el-tag v-else :type="row.is_completed ? 'success' : 'info'">
              {{ row.is_completed ? '是' : '否' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="can_ship" label="可出货" width="100">
          <template #default="{ row }">
            <el-switch
              v-if="authStore.isAdmin || authStore.isProductionManager"
              v-model="row.can_ship"
              size="small"
              @change="handleCanShipChange(row)"
            />
            <el-tag v-else :type="row.can_ship ? 'success' : 'info'">
              {{ row.can_ship ? '是' : '否' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="estimated_ship_date" label="预计出货日期" width="200">
          <template #default="{ row }">
            <el-date-picker
              v-if="authStore.isAdmin || authStore.isProductionManager"
              v-model="row.estimated_ship_date"
              type="date"
              placeholder="选择日期"
              size="small"
              style="width: 100%"
              value-format="YYYY-MM-DD"
              format="YYYY-MM-DD"
              @change="(val: string | null) => handleEstimatedShipDateChange(row, val)"
            />
            <span v-else>{{ formatDate(row.estimated_ship_date) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="notes" label="备注" min-width="200">
          <template #default="{ row }">
            <span class="notes-text" :title="row.notes">{{ row.notes || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
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
              v-if="authStore.isAdmin"
              type="success"
              size="small"
              link
              @click="handleQuickEdit(row)"
            >
              编辑
            </el-button>
            <el-button
              v-if="authStore.isAdmin && !row.is_completed"
              type="success"
              size="small"
              link
              @click="handleComplete(row.id)"
            >
              完成
            </el-button>
            <el-button
              v-if="authStore.isAdmin"
              type="info"
              size="small"
              link
              @click="handleAssign(row)"
            >
              分配
            </el-button>
            <el-button
              v-if="authStore.isCustomer && !row.can_ship"
              type="warning"
              size="small"
              link
              @click="handleReminder(row.id)"
            >
              催货
            </el-button>
            <el-button
              v-if="authStore.isAdmin"
              type="danger"
              size="small"
              link
              @click="handleDelete(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 移动端：订单卡片列表 -->
      <div v-loading="ordersStore.loading" class="mobile-card-list">
        <div
          v-for="order in ordersStore.orders"
          :key="order.id"
          class="order-card"
        >
          <div class="card-header-section">
            <div class="card-image-section">
              <el-image
                v-if="order.images && order.images.length > 0"
                :src="order.images[0]"
                :preview-src-list="order.images"
                :initial-index="0"
                fit="cover"
                class="order-thumbnail-mobile"
                :preview-teleported="true"
                lazy
              >
                <template #error>
                  <div class="image-slot-mobile">
                    <el-icon><Picture /></el-icon>
                  </div>
                </template>
              </el-image>
              <div v-else class="no-image-mobile">-</div>
            </div>
            <div class="card-title-section">
              <div class="order-number">{{ order.order_number }}</div>
              <div class="customer-order-number" v-if="order.customer_order_number">
                {{ order.customer_order_number }}
              </div>
            </div>
          </div>

          <div class="card-content">
            <div class="card-row" v-if="authStore.isAdmin && order.company_name">
              <span class="label">客户公司：</span>
              <span class="value">{{ order.company_name }}</span>
            </div>
            <div class="card-row">
              <span class="label">状态：</span>
              <span class="value">
                <el-select
                  v-if="authStore.isAdmin"
                  v-model="order.status"
                  size="small"
                  class="status-select-mobile"
                  @change="handleStatusChange(order)"
                >
                  <el-option
                    v-for="status in orderStatuses"
                    :key="status.value"
                    :label="status.label"
                    :value="status.value"
                  />
                </el-select>
                <el-tag v-else :type="getStatusType(order.status)" size="small">
                  {{ getStatusText(order.status) }}
                </el-tag>
              </span>
            </div>
            <div class="card-row">
              <span class="label">是否完成：</span>
              <span class="value">
                <el-switch
                  v-if="authStore.isAdmin || authStore.isProductionManager"
                  v-model="order.is_completed"
                  size="small"
                  @change="handleIsCompletedChange(order)"
                />
                <el-tag v-else :type="order.is_completed ? 'success' : 'info'" size="small">
                  {{ order.is_completed ? '是' : '否' }}
                </el-tag>
              </span>
            </div>
            <div class="card-row">
              <span class="label">可出货：</span>
              <span class="value">
                <el-switch
                  v-if="authStore.isAdmin || authStore.isProductionManager"
                  v-model="order.can_ship"
                  size="small"
                  @change="handleCanShipChange(order)"
                />
                <el-tag v-else :type="order.can_ship ? 'success' : 'info'" size="small">
                  {{ order.can_ship ? '是' : '否' }}
                </el-tag>
              </span>
            </div>
            <div class="card-row">
              <span class="label">预计出货日期：</span>
              <span class="value">
                <el-date-picker
                  v-if="authStore.isAdmin || authStore.isProductionManager"
                  v-model="order.estimated_ship_date"
                  type="date"
                  placeholder="选择日期"
                  size="small"
                  class="date-picker-mobile"
                  value-format="YYYY-MM-DD"
                  format="YYYY-MM-DD"
                  @change="(val: string | null) => handleEstimatedShipDateChange(order, val)"
                />
                <span v-else>{{ formatDate(order.estimated_ship_date || '') }}</span>
              </span>
            </div>
            <div class="card-row">
              <span class="label">备注：</span>
              <span class="value">
                <span class="notes-text">{{ order.notes || '-' }}</span>
              </span>
            </div>
          </div>

          <div class="card-actions">
            <el-button
              type="primary"
              size="small"
              @click="viewOrder(order.id)"
            >
              查看
            </el-button>
            <el-button
              v-if="authStore.isAdmin"
              type="success"
              size="small"
              @click="handleQuickEdit(order)"
            >
              编辑
            </el-button>
            <el-button
              v-if="authStore.isAdmin && !order.is_completed"
              type="success"
              size="small"
              @click="handleComplete(order.id)"
            >
              完成
            </el-button>
            <el-button
              v-if="authStore.isAdmin"
              type="info"
              size="small"
              @click="handleAssign(order)"
            >
              分配
            </el-button>
            <el-button
              v-if="authStore.isCustomer && !order.can_ship"
              type="warning"
              size="small"
              @click="handleReminder(order.id)"
            >
              催货
            </el-button>
            <el-button
              v-if="authStore.isAdmin"
              type="danger"
              size="small"
              @click="handleDelete(order)"
            >
              删除
            </el-button>
          </div>
        </div>
      </div>

      <!-- 分页 -->
      <div class="pagination">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="ordersStore.pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          :layout="isMobile ? 'prev, pager, next' : 'total, sizes, prev, pager, next, jumper'"
          :small="isMobile"
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

    <!-- 快速编辑对话框 -->
    <OrderEditDialog
      v-model="editDialogVisible"
      :order="currentEditOrder"
      @success="handleEditSuccess"
    />

    <!-- 分配订单对话框 -->
    <el-dialog
      v-model="assignDialogVisible"
      title="分配订单给生产跟单"
      :width="isMobile ? '90%' : '500px'"
    >
      <el-form :model="assignForm" label-width="120px">
        <el-form-item label="订单编号">
          <el-input :value="currentAssignOrder?.order_number" readonly />
        </el-form-item>
        <el-form-item label="订单类型">
          <el-select
            v-model="assignForm.order_type"
            placeholder="请选择订单类型"
            style="width: 100%"
            @change="handleOrderTypeChange"
          >
            <el-option
              v-for="type in orderTypes"
              :key="type.value"
              :label="type.label"
              :value="type.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="分配给">
          <el-select
            v-model="assignForm.assigned_to"
            placeholder="请选择生产跟单（留空表示取消分配）"
            clearable
            filterable
            style="width: 100%"
          >
            <el-option
              v-for="pm in productionManagers"
              :key="pm.id"
              :label="pm.admin_notes || pm.username"
              :value="pm.id"
              :disabled="
                assignForm.order_type &&
                pm.assigned_order_types &&
                !pm.assigned_order_types.includes(assignForm.order_type)
              "
            >
              <span>{{ pm.admin_notes || pm.username }}</span>
              <span
                v-if="
                  assignForm.order_type &&
                  pm.assigned_order_types &&
                  !pm.assigned_order_types.includes(assignForm.order_type)
                "
                style="color: #f56c6c; margin-left: 10px"
              >
                (无权限处理此订单类型)
              </span>
            </el-option>
          </el-select>
          <div style="font-size: 12px; color: #909399; margin-top: 4px">
            提示：只能分配给有权限处理该订单类型的生产跟单
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="assignDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitAssign">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive, onUnmounted, nextTick, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Picture } from '@element-plus/icons-vue';
import { useAuthStore } from '../../stores/auth';
import { useOrdersStore } from '../../stores/orders';
import { ordersApi } from '../../api/orders';
import { useConfigOptions } from '../../composables/useConfigOptions';
// @ts-ignore - Vue SFC with script setup
import ReminderDialog from '../../components/ReminderDialog.vue';
// @ts-ignore - Vue SFC with script setup
import OrderEditDialog from '../../components/OrderEditDialog.vue';
import type { Order } from '../../types';

const router = useRouter();
const authStore = useAuthStore();
const ordersStore = useOrdersStore();

// 配置选项
const { orderTypes, orderStatuses, loadOrderTypes, loadOrderStatuses } = useConfigOptions();

// 移动端检测
const isMobile = ref(window.innerWidth <= 768);

const checkMobile = () => {
  isMobile.value = window.innerWidth <= 768;
};

// 监听选项加载，确保默认值正确显示
watch(
  () => orderStatuses.value.length,
  (newLength) => {
    if (newLength > 0 && (!filters.status || filters.status === '')) {
      // 使用 nextTick 确保 DOM 更新后再设置值
      nextTick(() => {
        filters.status = 'all';
      });
    }
  },
  { immediate: true }
);

onMounted(async () => {
  checkMobile();
  window.addEventListener('resize', checkMobile);
  // 加载配置选项
  await Promise.all([
    loadOrderTypes(),
    loadOrderStatuses(),
  ]);
  // 在选项加载完成后设置默认值
  await nextTick();
  // 设置默认值
  if (!filters.status || filters.status === '') {
    filters.status = 'all';
  }
  if (filters.is_completed === undefined || filters.is_completed === null) {
    filters.is_completed = 'all';
  }
  // 再次等待 DOM 更新，确保下拉框能正确显示默认值
  await nextTick();
  // 初始加载订单列表
  loadOrders();
});

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile);
});

const filters = reactive({
  order_number: '',
  customer_order_number: '',
  status: 'all',
  is_completed: 'all' as 'all' | boolean | undefined,
});

const currentPage = ref(1);
const pageSize = ref(20);
const reminderDialogVisible = ref(false);
const selectedOrderId = ref<number | null>(null);
const editDialogVisible = ref(false);
const currentEditOrder = ref<Order | null>(null);
const assignDialogVisible = ref(false);
const currentAssignOrder = ref<Order | null>(null);
const productionManagers = ref<any[]>([]);
const assignForm = reactive({
  assigned_to: undefined as number | undefined,
  order_type: 'required' as 'required' | 'scattered' | 'photo',
});

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

const formatDate = (date: string) => {
  if (!date) return '-';
  try {
    const dateObj = new Date(date);
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  } catch (error) {
    return date;
  }
};

// formatDateTimeForPicker 函数已移除，现在直接使用 v-model 绑定日期字符串

const loadOrders = async () => {
  try {
    await ordersStore.fetchOrders({
      page: currentPage.value,
      pageSize: pageSize.value,
      order_number: filters.order_number || undefined,
      customer_order_number: filters.customer_order_number || undefined,
      status: filters.status === 'all' ? undefined : filters.status || undefined,
      is_completed: filters.is_completed === 'all' ? undefined : (filters.is_completed as boolean | undefined),
    });
  } catch (error) {
    ElMessage.error('加载订单列表失败');
  }
};

const resetFilters = () => {
  filters.order_number = '';
  filters.customer_order_number = '';
  filters.status = 'all';
  filters.is_completed = 'all';
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

const handleStatusChange = async (row: Order) => {
  const originalStatus = row.status;
  try {
    const response = await ordersStore.updateOrder(row.id, { status: row.status });
    // 更新当前行的数据，保留所有字段（包括 company_name 等关联字段）
    const index = ordersStore.orders.findIndex((o) => o.id === row.id);
    if (index !== -1 && response.order) {
      // 合并更新后的数据，保留原有的关联字段
      ordersStore.orders[index] = { ...ordersStore.orders[index], ...response.order };
    }
    ElMessage.success('订单状态已更新');
  } catch (error) {
    ElMessage.error('更新失败');
    // 恢复原值
    row.status = originalStatus;
  }
};

const handleIsCompletedChange = async (row: Order) => {
  const originalIsCompleted = row.is_completed;
  try {
    const response = await ordersStore.updateOrder(row.id, { is_completed: row.is_completed });
    // 更新当前行的数据，保留所有字段（包括 company_name 等关联字段）
    const index = ordersStore.orders.findIndex((o) => o.id === row.id);
    if (index !== -1 && response.order) {
      // 合并更新后的数据，保留原有的关联字段
      ordersStore.orders[index] = { ...ordersStore.orders[index], ...response.order };
    }
    ElMessage.success('完成状态已更新');
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '更新失败');
    // 恢复原值
    row.is_completed = originalIsCompleted;
  }
};

const handleCanShipChange = async (row: Order) => {
  const originalCanShip = row.can_ship;
  try {
    const response = await ordersStore.updateOrder(row.id, { can_ship: row.can_ship });
    // 更新当前行的数据，保留所有字段（包括 company_name 等关联字段）
    const index = ordersStore.orders.findIndex((o) => o.id === row.id);
    if (index !== -1 && response.order) {
      // 合并更新后的数据，保留原有的关联字段
      ordersStore.orders[index] = { ...ordersStore.orders[index], ...response.order };
    }
    ElMessage.success('可出货状态已更新');
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '更新失败');
    // 恢复原值
    row.can_ship = originalCanShip;
  }
};

const handleEstimatedShipDateChange = async (row: Order, newValue: string | null) => {
  const originalDate = row.estimated_ship_date;
  try {
    const response = await ordersStore.updateOrder(row.id, {
      estimated_ship_date: newValue || undefined,
    });
    // 更新当前行的数据，保留所有字段（包括 company_name 等关联字段）
    const index = ordersStore.orders.findIndex((o) => o.id === row.id);
    if (index !== -1 && response.order) {
      // 合并更新后的数据，保留原有的关联字段
      ordersStore.orders[index] = { ...ordersStore.orders[index], ...response.order };
    }
    ElMessage.success('预计出货日期已更新');
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '更新失败');
    // 恢复原值
    row.estimated_ship_date = originalDate;
  }
};

// 备注编辑功能已移除，现在只在编辑对话框中编辑

const handleQuickEdit = (row: Order) => {
  currentEditOrder.value = { ...row };
  editDialogVisible.value = true;
};

const handleEditSuccess = () => {
  loadOrders();
};

const handleAssign = async (row: Order) => {
  currentAssignOrder.value = { ...row };
  assignForm.assigned_to = row.assigned_to;
  assignForm.order_type = (row.order_type || 'required') as 'required' | 'scattered' | 'photo';
  assignDialogVisible.value = true;
  
  // 加载生产跟单列表
  if (productionManagers.value.length === 0) {
    try {
      const response = await ordersApi.getProductionManagers();
      productionManagers.value = response.productionManagers;
    } catch (error) {
      ElMessage.error('加载生产跟单列表失败');
    }
  }
};

const handleOrderTypeChange = () => {
  // 当订单类型改变时，清空已选择的生产跟单（如果该生产跟单没有权限）
  if (assignForm.assigned_to) {
    const selectedPM = productionManagers.value.find(
      (pm) => pm.id === assignForm.assigned_to
    );
    if (
      selectedPM &&
      selectedPM.assigned_order_types &&
      !selectedPM.assigned_order_types.includes(assignForm.order_type)
    ) {
      // 如果当前选择的生产跟单没有权限处理新选择的订单类型，清空选择
      assignForm.assigned_to = undefined;
      ElMessage.warning('当前选择的生产跟单没有权限处理此订单类型，已清空选择');
    }
  }
};

const submitAssign = async () => {
  if (!currentAssignOrder.value) return;

  try {
    // 如果订单类型改变了，先更新订单类型
    if (assignForm.order_type !== currentAssignOrder.value.order_type) {
      await ordersStore.updateOrder(currentAssignOrder.value.id, {
        order_type: assignForm.order_type,
      });
    }

    // 然后分配订单
    await ordersApi.assignOrder(
      currentAssignOrder.value.id,
      assignForm.assigned_to
    );
    ElMessage.success('订单分配成功');
    assignDialogVisible.value = false;
    await loadOrders();
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '分配失败');
  }
};

const handleDelete = async (row: Order) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除订单"${row.order_number}"吗？此操作将同时删除相关的状态历史和催货记录，且无法恢复。`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );

    await ordersStore.deleteOrder(row.id);
    ElMessage.success('订单删除成功');
    
    // 如果当前页没有数据了，返回上一页
    if (ordersStore.orders.length === 0 && currentPage.value > 1) {
      currentPage.value -= 1;
    }
    
    loadOrders();
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('删除订单失败');
    }
  }
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
  padding: 0;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.card-header h3 {
  margin: 0;
  font-size: 18px;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.filters {
  margin-bottom: 20px;
}

.filter-form {
  width: 100%;
}

.filter-form :deep(.el-form-item) {
  margin-bottom: 15px;
  /* 确保 el-select 在 inline-flex 模式下能正确显示 */
  vertical-align: top;
  /* 确保 form-item 有足够的宽度 */
  flex: 0 0 auto;
}

.filter-form :deep(.el-form-item__content) {
  /* 确保内容区域有足够的宽度，不会被压缩 */
  min-width: 0;
  flex: 0 0 auto;
  /* 确保 el-select 能正确计算宽度 */
  display: inline-block;
  width: auto;
}

.filter-input,
.filter-select {
  width: 100%;
  max-width: 200px;
  /* 确保 select 组件有明确的宽度 */
  min-width: 100px;
  /* 确保 select 组件能正确显示 */
  display: inline-block;
}

.filter-buttons {
  width: 100%;
}

.filter-buttons :deep(.el-form-item__content) {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.order-thumbnail {
  width: 50px;
  height: 50px;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid #dcdfe6;
  object-fit: cover;
}

.image-slot {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 50px;
  height: 50px;
  background: #f5f7fa;
  color: #909399;
  font-size: 20px;
}

.no-image {
  color: #c0c4cc;
  font-size: 14px;
}

/* 桌面端表格显示 */
.desktop-table {
  display: block;
}

/* 移动端卡片列表显示 */
.mobile-card-list {
  display: none;
}

.order-card {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  padding: 15px;
  margin-bottom: 15px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.card-header-section {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 15px;
  padding-bottom: 15px;
  border-bottom: 1px solid #ebeef5;
}

.card-image-section {
  flex-shrink: 0;
}

.order-thumbnail-mobile {
  width: 60px;
  height: 60px;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid #dcdfe6;
  object-fit: cover;
}

.image-slot-mobile {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 60px;
  height: 60px;
  background: #f5f7fa;
  color: #909399;
  font-size: 24px;
  border-radius: 4px;
}

.no-image-mobile {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 60px;
  height: 60px;
  color: #c0c4cc;
  font-size: 14px;
  background: #f5f7fa;
  border-radius: 4px;
}

.card-title-section {
  flex: 1;
  min-width: 0;
}

.order-number {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 5px;
  word-break: break-all;
}

.customer-order-number {
  font-size: 14px;
  color: #606266;
  word-break: break-all;
}

.card-content {
  margin-bottom: 15px;
}

.card-row {
  display: flex;
  align-items: flex-start;
  margin-bottom: 12px;
  font-size: 14px;
  line-height: 1.6;
}

.card-row:last-child {
  margin-bottom: 0;
}

.card-row .label {
  color: #909399;
  min-width: 90px;
  flex-shrink: 0;
  font-weight: 500;
}

.card-row .value {
  color: #303133;
  flex: 1;
  word-break: break-all;
}

.card-row .notes-text {
  color: #606266;
  line-height: 1.5;
}

.status-select-mobile,
.date-picker-mobile {
  width: 100%;
  max-width: 200px;
}

.card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 15px;
  border-top: 1px solid #ebeef5;
}

.card-actions .el-button {
  flex: 1;
  min-width: 60px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .order-list {
    padding: 0;
  }

  .card-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .card-header h3 {
    font-size: 16px;
  }

  .create-btn {
    width: 100%;
  }

  .filter-form :deep(.el-form-item) {
    margin-bottom: 12px;
  }

  .filter-input,
  .filter-select {
    max-width: 100%;
  }

  .filter-buttons :deep(.el-form-item__content) {
    width: 100%;
  }

  .filter-buttons .el-button {
    flex: 1;
    min-width: 0;
  }

  /* 移动端隐藏表格，显示卡片 */
  .desktop-table {
    display: none !important;
  }

  .mobile-card-list {
    display: block;
  }

  .pagination {
    justify-content: center;
  }

  .pagination :deep(.el-pagination) {
    justify-content: center;
  }

  .card-row .label {
    min-width: 80px;
    font-size: 13px;
  }

  .card-row .value {
    font-size: 13px;
  }

  .order-number {
    font-size: 15px;
  }

  .customer-order-number {
    font-size: 13px;
  }
}

@media (min-width: 769px) {
  /* 桌面端隐藏卡片，显示表格 */
  .mobile-card-list {
    display: none !important;
  }

  .desktop-table {
    display: block;
  }
}
</style>

