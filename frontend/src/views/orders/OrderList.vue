<template>
  <div class="order-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <h3>订单列表</h3>
          <div class="header-actions">
            <el-button
              v-if="authStore.canManageOrders"
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
          <el-form-item v-if="authStore.canManageOrders" label="客户公司">
            <el-select
              v-model="filters.company_name"
              placeholder="请选择客户公司"
              clearable
              filterable
              class="filter-select"
            >
              <el-option
                v-for="company in companyNames"
                :key="company"
                :label="company"
                :value="company"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="预计出货时间">
            <!-- 桌面端：使用日期范围选择器 -->
            <el-date-picker
              v-if="!estimatedShipDateRange.isMobile.value"
              v-model="estimatedShipDateRange.dateRange.value"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              value-format="YYYY-MM-DD"
              class="filter-select"
              :unlink-panels="false"
              popper-class="mobile-date-picker-popper"
            />
            <!-- 手机端：使用两个独立的日期选择器 -->
            <div v-else class="mobile-date-range">
              <el-date-picker
                v-model="estimatedShipDateRange.dateStart.value"
                type="date"
                placeholder="开始日期"
                value-format="YYYY-MM-DD"
                class="filter-select mobile-date-picker"
                popper-class="mobile-date-picker-popper"
                style="width: 100%; margin-bottom: 8px;"
              />
              <el-date-picker
                v-model="estimatedShipDateRange.dateEnd.value"
                type="date"
                placeholder="结束日期"
                value-format="YYYY-MM-DD"
                class="filter-select mobile-date-picker"
                popper-class="mobile-date-picker-popper"
                style="width: 100%;"
              />
            </div>
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
        <el-table-column prop="order_number" label="工厂订单编号" width="180">
          <template #default="{ row }">
            <div class="order-number-cell">
              <span>{{ row.order_number }}</span>
              <el-badge
                v-if="getOrderReminderCount(row.id) > 0"
                :value="getOrderReminderCount(row.id)"
                type="danger"
                class="reminder-badge"
              />
              <el-badge
                v-if="getOrderAssignmentCount(row.id) > 0"
                :value="getOrderAssignmentCount(row.id)"
                type="primary"
                class="assignment-badge"
              />
            </div>
          </template>
        </el-table-column>
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
          v-if="authStore.canManageOrders"
          prop="company_name"
          label="客户公司"
          width="180"
        />
        <el-table-column prop="status" label="状态" width="140">
          <template #default="{ row }">
            <el-select
              v-if="authStore.canManageOrders"
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
        <el-table-column
          v-if="authStore.canManageOrders || authStore.isProductionManager"
          label="生产跟单"
          min-width="180"
        >
          <template #default="{ row }">
            <div v-if="row.assigned_team && row.assigned_team.length" class="assigned-tags">
              <el-tag
                v-for="member in row.assigned_team"
                :key="member.id"
                size="small"
                effect="plain"
                style="margin-right: 4px; margin-bottom: 4px"
              >
                {{ member.username || `ID ${member.id}` }}
              </el-tag>
            </div>
            <span v-else>{{ row.assigned_to_name || '未分配' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="is_completed" label="是否完成" width="100">
          <template #default="{ row }">
            <el-switch
              v-if="authStore.canManageOrders || authStore.isProductionManager"
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
              v-if="authStore.canManageOrders || authStore.isProductionManager"
              v-model="row.can_ship"
              size="small"
              @change="handleCanShipChange(row)"
            />
            <el-tag v-else :type="row.can_ship ? 'success' : 'info'">
              {{ row.can_ship ? '是' : '否' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="order_date" label="下单时间" width="180">
          <template #default="{ row }">
            <span v-if="row.order_date">{{ formatDateTime(row.order_date) }}</span>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="estimated_ship_date" label="预计出货日期" width="220">
          <template #default="{ row }">
            <el-date-picker
              v-if="authStore.canManageOrders || authStore.isProductionManager"
              v-model="row.estimated_ship_date"
              type="datetime"
              placeholder="选择日期时间"
              size="small"
              style="width: 100%"
              value-format="YYYY-MM-DD HH:mm:ss"
              format="YYYY-MM-DD HH:mm"
              @change="(val: string | null) => handleEstimatedShipDateChange(row, val)"
            />
            <span v-else>{{ formatDateTime(row.estimated_ship_date) }}</span>
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
              v-if="authStore.canManageOrders"
              type="success"
              size="small"
              link
              @click="handleQuickEdit(row)"
            >
              编辑
            </el-button>
            <el-button
              v-if="authStore.canManageOrders && !row.is_completed"
              type="success"
              size="small"
              link
              @click="handleComplete(row.id)"
            >
              完成
            </el-button>
            <el-button
              v-if="authStore.canManageOrders"
              :type="row.assigned_to_ids?.length ? 'success' : 'info'"
              size="small"
              link
              @click="handleAssign(row)"
            >
              {{ row.assigned_to_ids?.length ? '已分配' : '分配' }}
            </el-button>
            <el-button
              v-if="authStore.isCustomer"
              type="warning"
              size="small"
              link
              :disabled="row.can_ship || (reminderStats.getReminderStats(row.id) && !reminderStats.canRemind(row.id))"
              @click="handleReminder(row.id)"
            >
              <span>催货</span>
              <span v-if="reminderStats.getReminderStats(row.id)?.total_count" style="margin-left: 4px; font-size: 11px; opacity: 0.7;">
                ({{ reminderStats.getReminderStats(row.id)?.total_count }}次)
              </span>
              <span v-if="reminderStats.getReminderStats(row.id) && !reminderStats.canRemind(row.id)" style="margin-left: 4px; font-size: 11px; color: #f56c6c;">
                ({{ reminderStats.formatRemainingTime(reminderCountdowns.get(row.id) || 0) }})
              </span>
              <span v-if="row.can_ship" style="margin-left: 4px; font-size: 11px; opacity: 0.7;">
                (已可出货)
              </span>
            </el-button>
            <el-button
              v-if="authStore.canManageOrders"
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
      <div class="mobile-card-list">
        <OrderMobileCardList
          :orders="ordersStore.orders"
          :loading="ordersStore.loading"
          :auth="authFlags"
          :order-statuses="orderStatuses"
          :get-status-type="getStatusType"
          :get-status-text="getStatusText"
          :format-date-time="formatDateTime"
          :get-order-reminder-count="getOrderReminderCount"
          :get-order-assignment-count="getOrderAssignmentCount"
          :reminder-stats="authStore.isCustomer ? reminderStats : undefined"
          :get-reminder-countdown="getReminderCountdown"
          @view="viewOrder"
          @quick-edit="handleQuickEdit"
          @complete="handleComplete"
          @assign="handleAssign"
          @delete="handleDelete"
          @reminder="handleReminder"
          @update-status="handleStatusChange"
          @update-completed="handleIsCompletedChange"
          @update-can-ship="handleCanShipChange"
          @update-estimated-ship-date="handleEstimatedShipDateChangeFromCard"
        />
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
            v-model="assignForm.assigned_to_ids"
            placeholder="请选择生产跟单（可多选，留空表示取消分配）"
            multiple
            collapse-tags
            collapse-tags-tooltip
            clearable
            filterable
            style="width: 100%"
            @change="handleAssignedChange"
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
            提示：只能分配给有权限处理该订单类型的生产跟单；可多选实现协同处理
          </div>
        </el-form-item>
        <el-form-item v-if="assignForm.assigned_to_ids.length > 1" label="主负责人">
          <el-select
            v-model="assignForm.primary_assigned_to"
            placeholder="请选择主负责人"
            style="width: 100%"
          >
            <el-option
              v-for="pmId in assignForm.assigned_to_ids"
              :key="pmId"
              :label="getProductionManagerName(pmId)"
              :value="pmId"
            />
          </el-select>
          <div style="font-size: 12px; color: #909399; margin-top: 4px">
            主负责人用于在列表中展示及兼容旧版权限
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
import { ref, onMounted, reactive, onUnmounted, nextTick, watch, computed } from 'vue';
import { useMobileDateRange } from '../../composables/useMobileDateRange';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Picture } from '@element-plus/icons-vue';
import { useAuthStore } from '../../stores/auth';
import { useOrdersStore } from '../../stores/orders';
import { useNotificationsStore } from '../../stores/notifications';
import { ordersApi } from '../../api/orders';
import { useConfigOptions } from '../../composables/useConfigOptions';
import { useReminderStats } from '../../composables/useReminderStats';
// @ts-ignore
import OrderMobileCardList from '../../components/orders/OrderMobileCardList.vue';
// @ts-ignore - Vue SFC with script setup
import ReminderDialog from '../../components/ReminderDialog.vue';
// @ts-ignore - Vue SFC with script setup
import OrderEditDialog from '../../components/OrderEditDialog.vue';
import type { Order } from '../../types';

const router = useRouter();
const authStore = useAuthStore();
const authFlags = computed(() => ({
  canManageOrders: authStore.canManageOrders,
  canManageReminders: authStore.canManageReminders,
  isProductionManager: authStore.isProductionManager,
  isCustomer: authStore.isCustomer,
}));
const ordersStore = useOrdersStore();
const notificationsStore = useNotificationsStore();

// 订单相关的未读通知映射
const orderNotifications = ref<Map<number, { reminder: number; assignment: number }>>(new Map());

// 配置选项
const { orderTypes, orderStatuses, loadOrderTypes, loadOrderStatuses } = useConfigOptions();

// 客户公司列表
const companyNames = ref<string[]>([]);

// 移动端检测
const isMobile = ref(window.innerWidth <= 768);

const checkMobile = () => {
  isMobile.value = window.innerWidth <= 768;
};

// 使用手机端日期范围 composable
const estimatedShipDateRange = useMobileDateRange();

// 加载客户公司列表
const loadCompanyNames = async () => {
  if (!authStore.canManageOrders) return; // 只有具备订单管理权限的角色需要加载客户公司列表
  
  try {
    const response = await ordersApi.getCustomers();
    // 提取所有唯一的公司名称，过滤掉空值
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

onMounted(async () => {
  checkMobile();
  window.addEventListener('resize', checkMobile);
  // 加载配置选项和客户公司列表
  await Promise.all([
    loadOrderTypes(),
    loadOrderStatuses(),
    loadCompanyNames(),
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
  company_name: '',
  estimated_ship_date_range: [] as string[],
  // 手机端独立的开始和结束日期（已迁移到 composable，保留用于兼容）
  estimated_ship_date_start: '' as string,
  estimated_ship_date_end: '' as string,
});

// 同步 composable 的数据到 filters（用于兼容现有代码）
watch(
  () => estimatedShipDateRange.dateRange.value,
  (range) => {
    filters.estimated_ship_date_range = range;
  },
  { immediate: true }
);

watch(
  () => estimatedShipDateRange.dateStart.value,
  (start) => {
    filters.estimated_ship_date_start = start;
  },
  { immediate: true }
);

watch(
  () => estimatedShipDateRange.dateEnd.value,
  (end) => {
    filters.estimated_ship_date_end = end;
  },
  { immediate: true }
);

// 反向同步：从 filters 同步到 composable
watch(
  () => filters.estimated_ship_date_range,
  (range) => {
    if (JSON.stringify(range) !== JSON.stringify(estimatedShipDateRange.dateRange.value)) {
      estimatedShipDateRange.dateRange.value = range;
    }
  }
);

watch(
  () => filters.estimated_ship_date_start,
  (start) => {
    if (start !== estimatedShipDateRange.dateStart.value) {
      estimatedShipDateRange.dateStart.value = start;
    }
  }
);

watch(
  () => filters.estimated_ship_date_end,
  (end) => {
    if (end !== estimatedShipDateRange.dateEnd.value) {
      estimatedShipDateRange.dateEnd.value = end;
    }
  }
);

// 监听选项加载，确保默认值正确显示
watch(
  () => orderStatuses.value.length,
  (newLength) => {
    if (newLength > 0 && (!filters.status || filters.status === '')) {
      nextTick(() => {
        filters.status = 'all';
      });
    }
  },
  { immediate: true }
);

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
  assigned_to_ids: [] as number[],
  primary_assigned_to: undefined as number | undefined,
  order_type: 'required' as 'required' | 'scattered' | 'photo',
});

// 催货统计管理
const reminderStats = useReminderStats();
const reminderCountdowns = ref<Map<number, number>>(new Map());
const getReminderCountdown = (orderId: number) =>
  reminderCountdowns.value.get(orderId) || 0;

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
  return map[status] || status;
};

// 规范化日期时间字符串，确保格式为 YYYY-MM-DD HH:mm:ss
const stripTimezoneInfo = (value: string) => {
  if (!value) return value;
  if (value.includes('T')) {
    const [datePart, timePartRaw] = value.split('T');
    const timePart = timePartRaw
      .replace('Z', '')
      .split('.')[0]
      .trim();
    return `${datePart} ${timePart || '00:00:00'}`;
  }
  return value;
};

const normalizeDateTime = (date: string | null | undefined): string | null => {
  if (!date) return null;
  
  // 如果已经是 YYYY-MM-DD HH:mm:ss 格式，直接返回
  if (date.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
    return date;
  }
  
  // 如果只有日期部分 YYYY-MM-DD，添加默认时间
  if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return `${date} 00:00:00`;
  }
  
  // 如果是 ISO 格式（带时区），需要解析为本地时间
  // 例如：2025-11-27T16:00:00.000Z 或 2025-11-27T16:00:00+08:00
  if (date.includes('T')) {
    try {
      // 使用 Date 对象解析，然后转换为本地时间字符串
      const dateObj = new Date(date);
      if (!isNaN(dateObj.getTime())) {
        // 使用本地时间方法，避免时区转换
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        const hours = String(dateObj.getHours()).padStart(2, '0');
        const minutes = String(dateObj.getMinutes()).padStart(2, '0');
        const seconds = String(dateObj.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      }
    } catch (error) {
      // 如果解析失败，尝试使用 stripTimezoneInfo
      const stripped = stripTimezoneInfo(date);
      if (stripped && stripped !== date) {
        return stripped;
      }
    }
  }
  
  return date;
};

const formatDateTime = (date: string) => {
  if (!date) return '-';
  if (date.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
    const [datePart, timePart] = date.split(' ');
    const [hours, minutes] = timePart.split(':');
    return `${datePart} ${hours}:${minutes}`;
  }
  if (date.includes('T')) {
    const stripped = stripTimezoneInfo(date);
    if (stripped) {
      const [datePart, timePart] = stripped.split(' ');
      const [hours, minutes] = timePart.split(':');
      return `${datePart} ${hours}:${minutes}`;
    }
  }
  return date;
};

// formatDateTimeForPicker 函数已移除，现在直接使用 v-model 绑定日期字符串
// formatDateUTC 函数已迁移到 useMobileDateRange composable 中

const buildEstimatedShipRange = () => {
  const { start, end } = estimatedShipDateRange.buildQueryParams({
    startTime: '00:00:00',
    endTime: '00:00:00',
    addOneDayToEnd: true,
  });
  
  return {
    estimatedShipStart: start,
    estimatedShipEnd: end,
  };
};

const loadOrders = async () => {
  try {
    const { estimatedShipStart, estimatedShipEnd } = buildEstimatedShipRange();

    await ordersStore.fetchOrders({
      page: currentPage.value,
      pageSize: pageSize.value,
      order_number: filters.order_number || undefined,
      customer_order_number: filters.customer_order_number || undefined,
      status: filters.status === 'all' ? undefined : filters.status || undefined,
      is_completed: filters.is_completed === 'all' ? undefined : (filters.is_completed as boolean | undefined),
      company_name: filters.company_name || undefined,
      estimated_ship_start: estimatedShipStart,
      estimated_ship_end: estimatedShipEnd,
    });
    
    // 规范化所有订单的日期字段，去除时区信息，避免 el-date-picker 解析时发生偏移
    ordersStore.orders.forEach(order => {
      if (order.estimated_ship_date) {
        order.estimated_ship_date = normalizeDateTime(order.estimated_ship_date) || order.estimated_ship_date;
      }
      if (!order.assigned_to_ids && order.assigned_to) {
        order.assigned_to_ids = [order.assigned_to];
      }
      if (!order.assigned_team && order.assigned_to_name) {
        order.assigned_team = [
          { id: order.assigned_to || 0, username: order.assigned_to_name },
        ];
      }
    });
    
    // 如果是客户，加载每个订单的催货统计
    if (authStore.isCustomer) {
      const promises = ordersStore.orders
        .map(order => reminderStats.fetchReminderStats(order.id));
      await Promise.all(promises);
      
      // 启动倒计时（立即设置初始值，避免显示0）
      ordersStore.orders.forEach(order => {
        const stats = reminderStats.getReminderStats(order.id);
        if (stats && stats.next_reminder_time) {
          // 立即计算并设置初始剩余时间
          const initialRemaining = reminderStats.getRemainingSeconds(order.id);
          if (initialRemaining > 0) {
            reminderCountdowns.value.set(order.id, initialRemaining);
          }
          // 启动倒计时
          reminderStats.startCountdown(order.id, (remaining) => {
            reminderCountdowns.value.set(order.id, remaining);
          });
        } else {
          // 如果没有限制，设置为0
          reminderCountdowns.value.set(order.id, 0);
        }
      });
    }
    
    // 加载订单相关的未读通知
    if (authStore.canManageOrders || authStore.isProductionManager) {
      await loadOrderNotifications();
    }
  } catch (error) {
    ElMessage.error('加载订单列表失败');
  }
};

// 加载订单相关的未读通知
const loadOrderNotifications = async () => {
  try {
    const response = await notificationsStore.fetchNotifications({
      page: 1,
      pageSize: 100, // 获取足够多的未读通知
      is_read: false,
    });
    
    // 构建订单通知映射
    const notificationMap = new Map<number, { reminder: number; assignment: number }>();
    
    response.notifications.forEach((notification) => {
      if (notification.related_type === 'order' && notification.related_id) {
        const orderId = notification.related_id;
        if (!notificationMap.has(orderId)) {
          notificationMap.set(orderId, { reminder: 0, assignment: 0 });
        }
        const counts = notificationMap.get(orderId)!;
        if (notification.type === 'reminder') {
          counts.reminder++;
        } else if (notification.type === 'assignment') {
          counts.assignment++;
        }
      }
    });
    
    orderNotifications.value = notificationMap;
  } catch (error) {
    console.error('加载订单通知失败:', error);
  }
};

// 获取订单的催单提醒数量
const getOrderReminderCount = (orderId: number): number => {
  return orderNotifications.value.get(orderId)?.reminder || 0;
};

// 获取订单的分配提醒数量
const getOrderAssignmentCount = (orderId: number): number => {
  return orderNotifications.value.get(orderId)?.assignment || 0;
};

const resetFilters = () => {
  filters.order_number = '';
  filters.customer_order_number = '';
  filters.status = 'all';
  filters.is_completed = 'all';
  filters.company_name = '';
  estimatedShipDateRange.reset();
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

const handleReminder = async (orderId: number) => {
  // 检查订单是否可以催货（已出货的订单不能催货）
  const order = ordersStore.orders.find(o => o.id === orderId);
  if (order && order.can_ship) {
    ElMessage.warning('订单已可出货，无需催货');
    return;
  }
  
  // 检查是否可以催货（节流检查）
  if (!reminderStats.canRemind(orderId)) {
    const remaining = reminderStats.getRemainingSeconds(orderId);
    const formatted = reminderStats.formatRemainingTime(remaining);
    ElMessage.warning(`催货过于频繁，请等待 ${formatted} 后再试`);
    return;
  }
  selectedOrderId.value = orderId;
  reminderDialogVisible.value = true;
};

// 监听催货成功，刷新通知和统计
watch(reminderDialogVisible, async (newVal) => {
  if (!newVal) {
    // 催货对话框关闭后，刷新通知和统计
    if (authStore.canManageOrders || authStore.isProductionManager) {
      loadOrderNotifications();
      notificationsStore.fetchUnreadCount();
    }
    // 如果是客户，刷新催货统计
    if (authStore.isCustomer && selectedOrderId.value) {
      await reminderStats.refreshStats(selectedOrderId.value);
      // 重新启动倒计时
      reminderStats.startCountdown(selectedOrderId.value, (remaining) => {
        reminderCountdowns.value.set(selectedOrderId.value!, remaining);
      });
      selectedOrderId.value = null;
    }
  }
});

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

// 防抖映射，避免重复请求
const dateChangePending = ref<Map<number, boolean>>(new Map());

const handleEstimatedShipDateChange = async (row: Order, newValue: string | null) => {
  // 防抖：如果该订单正在更新中，忽略新的请求
  if (dateChangePending.value.get(row.id)) {
    return;
  }
  
  const originalDate = row.estimated_ship_date;
  try {
    // 标记为正在更新
    dateChangePending.value.set(row.id, true);
    
    // 处理清除日期的情况
    let dateValue: string | null | undefined = newValue;
    
    // 如果 el-date-picker 返回空字符串或 null，表示清除日期
    if (dateValue === '' || dateValue === null) {
      dateValue = null;
    } else if (dateValue) {
      // el-date-picker 已经返回 YYYY-MM-DD HH:mm:ss 格式，直接使用
      // 但如果只有日期部分（长度10），添加默认时间
      if (dateValue.length === 10) {
        dateValue = `${dateValue} 00:00:00`;
      }
      // 确保格式正确，不需要再次规范化（el-date-picker 已经返回正确格式）
      // 只有在格式不对时才进行规范化
      if (!dateValue.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
        dateValue = normalizeDateTime(dateValue) || dateValue;
      }
    }
    
    // 保存用户选择的值（用于后续比较）
    const userSelectedValue = dateValue;
    
    // 立即更新本地值（乐观更新），避免时区转换问题
    row.estimated_ship_date = dateValue || undefined;
    
    // 发送更新请求：清除日期时传递 null，设置日期时传递规范化后的字符串
    const updatePayload: any = {};
    if (dateValue === null) {
      updatePayload.estimated_ship_date = null;
    } else if (dateValue) {
      updatePayload.estimated_ship_date = dateValue;
    } else {
      updatePayload.estimated_ship_date = undefined;
    }
    const response = await ordersStore.updateOrder(row.id, updatePayload);
    
    // 更新当前行的数据，保留所有字段（包括 company_name 等关联字段）
    const index = ordersStore.orders.findIndex((o) => o.id === row.id);
    if (index !== -1 && response.order) {
      // 合并更新后的数据，保留原有的关联字段
      ordersStore.orders[index] = { ...ordersStore.orders[index], ...response.order };
      
      // 关键修复：优先使用用户选择的值，确保显示与用户选择一致
      // 如果后端返回的日期与用户选择的不同（可能因为时区转换），使用用户选择的值
      if (userSelectedValue) {
        // 使用用户选择的值，确保显示正确
        ordersStore.orders[index].estimated_ship_date = userSelectedValue;
        row.estimated_ship_date = userSelectedValue;
      } else if (response.order.estimated_ship_date) {
        // 如果用户清空了日期，但后端返回了值，规范化后端返回的值
        const normalizedDate = normalizeDateTime(response.order.estimated_ship_date);
        if (normalizedDate) {
          ordersStore.orders[index].estimated_ship_date = normalizedDate;
          row.estimated_ship_date = normalizedDate;
        } else {
          ordersStore.orders[index].estimated_ship_date = response.order.estimated_ship_date;
          row.estimated_ship_date = response.order.estimated_ship_date;
        }
      } else {
        // 如果用户清空了日期
        ordersStore.orders[index].estimated_ship_date = undefined;
        row.estimated_ship_date = undefined;
      }
    }
    ElMessage.success('预计出货日期已更新');
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '更新失败');
    // 恢复原值
    row.estimated_ship_date = originalDate;
  } finally {
    // 清除更新标记
    dateChangePending.value.delete(row.id);
  }
};

const handleEstimatedShipDateChangeFromCard = (payload: {
  order: Order;
  value: string | null;
}) => {
  handleEstimatedShipDateChange(payload.order, payload.value);
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
  assignForm.assigned_to_ids =
    row.assigned_to_ids?.slice() ||
    (row.assigned_to ? [row.assigned_to] : []);
  assignForm.primary_assigned_to =
    row.assigned_to_ids?.[0] ||
    row.assigned_to ||
    undefined;
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
  if (!assignForm.assigned_to_ids.length) return;

  const filtered = assignForm.assigned_to_ids.filter((pmId) => {
    const pm = productionManagers.value.find((item) => item.id === pmId);
    if (
      pm &&
      pm.assigned_order_types &&
      assignForm.order_type &&
      !pm.assigned_order_types.includes(assignForm.order_type)
    ) {
      return false;
    }
    return true;
  });

  if (filtered.length !== assignForm.assigned_to_ids.length) {
    assignForm.assigned_to_ids = filtered;
    ElMessage.warning('已移除无权限的生产跟单');
  }

  handleAssignedChange();
};

const handleAssignedChange = () => {
  if (!assignForm.assigned_to_ids.length) {
    assignForm.primary_assigned_to = undefined;
    return;
  }
  if (
    !assignForm.primary_assigned_to ||
    !assignForm.assigned_to_ids.includes(assignForm.primary_assigned_to)
  ) {
    assignForm.primary_assigned_to = assignForm.assigned_to_ids[0];
  }
};

const getProductionManagerName = (id: number) => {
  const pm = productionManagers.value.find((item) => item.id === id);
  return pm?.admin_notes || pm?.username || `ID ${id}`;
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
    await ordersApi.assignOrder(currentAssignOrder.value.id, {
      assigned_to_ids: assignForm.assigned_to_ids,
      primary_assigned_to: assignForm.primary_assigned_to ?? null,
    });
    ElMessage.success('订单分配成功');
    assignDialogVisible.value = false;
    await loadOrders();
    
    // 刷新通知
    if (authStore.canManageOrders || authStore.isProductionManager) {
      notificationsStore.fetchUnreadCount();
    }
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

.assigned-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
}

.order-number-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.reminder-badge,
.assignment-badge {
  margin-left: 4px;
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

  .mobile-date-range {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
  }

  .mobile-date-picker {
    width: 100% !important;
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

