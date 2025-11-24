<template>
  <div class="order-detail">
    <el-card v-loading="loading">
      <template #header>
        <div class="card-header">
          <h3>订单详情</h3>
          <div class="header-actions">
            <el-button @click="handleBack">返回</el-button>
            <el-button
              v-if="authStore.isCustomer"
              type="warning"
              :disabled="order?.can_ship || (reminderStats.getReminderStats(order?.id || 0) && !reminderStats.canRemind(order?.id || 0))"
              @click="handleReminder"
            >
              <span>催货</span>
              <span v-if="reminderStats.getReminderStats(order?.id || 0)?.total_count" style="margin-left: 4px; font-size: 12px; opacity: 0.7;">
                ({{ reminderStats.getReminderStats(order?.id || 0)?.total_count }}次)
              </span>
              <span v-if="reminderStats.getReminderStats(order?.id || 0) && !reminderStats.canRemind(order?.id || 0)" style="margin-left: 4px; font-size: 12px; color: #f56c6c;">
                ({{ reminderStats.formatRemainingTime(reminderCountdown) }})
              </span>
              <span v-if="order?.can_ship" style="margin-left: 4px; font-size: 12px; opacity: 0.7;">
                (已可出货)
              </span>
            </el-button>
            <el-button
              v-if="authStore.canManageOrders && !order?.is_completed"
              type="success"
              @click="handleComplete"
            >
              完成任务
            </el-button>
            <el-button
              v-if="authStore.canManageOrders && order"
              type="primary"
              @click="handleEditOrder"
            >
              编辑订单
            </el-button>
          </div>
        </div>
      </template>

      <div v-if="order && order.id" class="detail-content">
        <!-- 基本信息 -->
        <el-descriptions title="基本信息" :column="2" border>
          <el-descriptions-item label="订单编号">
            {{ order.order_number }}
          </el-descriptions-item>
          <el-descriptions-item label="客户订单编号">
            <div v-if="authStore.isCustomer" style="display: flex; align-items: center; gap: 8px;">
              <span v-if="order.customer_order_number">{{ order.customer_order_number }}</span>
              <el-button
                type="primary"
                size="small"
                link
                @click="handleEditCustomerNumber"
              >
                {{ order.customer_order_number ? '编辑' : '提交订单编号' }}
              </el-button>
            </div>
            <span v-else-if="order.customer_order_number">{{ order.customer_order_number }}</span>
            <span v-else>-</span>
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="getStatusType(order.status)">
              {{ getStatusText(order.status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item
            v-if="authStore.canManageOrders || authStore.isProductionManager"
            label="生产跟单"
          >
            <span>{{ getAssignedNames(order) || '未分配' }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="是否完成">
            <el-tag :type="order.is_completed ? 'success' : 'info'">
              {{ order.is_completed ? '是' : '否' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="可出货">
            <el-tag :type="order.can_ship ? 'success' : 'info'">
              {{ order.can_ship ? '是' : '否' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="下单时间">
            {{ formatDateOnly(order.order_date || '') }}
          </el-descriptions-item>
          <el-descriptions-item label="预计出货日期">
            {{ formatDateOnly(order.estimated_ship_date || '') }}
          </el-descriptions-item>
          <el-descriptions-item label="实际出货日期">
            {{ formatDateOnly(order.actual_ship_date || '') }}
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">
            {{ formatDate(order.created_at) }}
          </el-descriptions-item>
        </el-descriptions>

        <!-- 客户信息 -->
        <el-descriptions
          v-if="authStore.canManageOrders"
          title="客户信息"
          :column="2"
          border
          style="margin-top: 20px"
        >
          <el-descriptions-item label="客户编号">
            {{ order.customer_code || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="公司名称">
            {{ order.company_name || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="联系人">
            {{ order.contact_name || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="联系电话">
            {{ order.customer_phone || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="邮箱">
            {{ order.customer_email || '-' }}
          </el-descriptions-item>
        </el-descriptions>

        <!-- 订单图片 -->
        <div v-if="order.images && order.images.length > 0" style="margin-top: 20px">
          <h4>订单图片</h4>
          <div class="image-gallery" style="margin-top: 10px">
            <el-image
              loading="lazy"
              v-for="(image, index) in order.images"
              :key="index"
              :src="image"
              :preview-src-list="order.images"
              :initial-index="index"
              fit="cover"
              class="order-image"
              :preview-teleported="true"
            />
          </div>
        </div>

        <!-- 发货单号 -->
        <div v-if="order.shipping_tracking_numbers && order.shipping_tracking_numbers.length > 0" style="margin-top: 20px">
          <h4>发货单号</h4>
          <div class="tracking-numbers" style="margin-top: 10px">
            <el-tag
              v-for="(tracking, index) in order.shipping_tracking_numbers"
              :key="index"
              :type="getTrackingType(tracking.type)"
              size="large"
              class="tracking-tag"
              @click="copyTrackingNumber(tracking.number)"
            >
              <span class="tracking-label">{{ tracking.label || getTrackingLabel(tracking.type) }}：</span>
              <span class="tracking-number">{{ tracking.number }}</span>
              <el-icon class="copy-icon"><DocumentCopy /></el-icon>
            </el-tag>
          </div>
        </div>

        <!-- 备注信息 -->
        <div style="margin-top: 20px">
          <h4>情况备注</h4>
          <el-input
            :value="order.notes || ''"
            type="textarea"
            :rows="4"
            placeholder="暂无备注"
            readonly
            style="margin-top: 10px"
          />
        </div>

        <!-- 内部备注（仅管理员可见） -->
        <div v-if="authStore.canManageOrders && order.internal_notes" style="margin-top: 20px">
          <h4>内部备注</h4>
          <el-input
            v-model="order.internal_notes"
            type="textarea"
            :rows="4"
            placeholder="暂无内部备注"
            readonly
            style="margin-top: 10px"
          />
        </div>

        <!-- 订单状态历史 -->
        <div style="margin-top: 20px">
          <h4>状态历史</h4>
          <el-timeline v-if="history.length > 0" style="margin-top: 10px">
            <el-timeline-item
              v-for="item in history"
              :key="item.id"
              :timestamp="formatDate(item.created_at)"
              placement="top"
            >
              <p>
                <strong>{{ item.changed_by_username || '系统' }}</strong>
                {{ getStatusText(item.old_status || '') }}
                <el-icon><Right /></el-icon>
                {{ getStatusText(item.new_status || '') }}
              </p>
              <p v-if="item.notes" style="color: #909399; font-size: 12px">
                {{ item.notes }}
              </p>
            </el-timeline-item>
          </el-timeline>
          <el-empty v-else description="暂无状态历史" />
        </div>
      </div>
      <div v-else-if="!loading" class="empty-state">
        <el-empty description="订单不存在或加载失败" />
      </div>
    </el-card>

    <!-- 订单详情和日志的布局容器 -->
    <div class="order-detail-layout">
      <!-- 左侧：跟进记录 -->
      <div class="order-detail-main">
        <!-- 跟进记录 -->
        <FollowUpRecord
          v-if="order && order.id"
          :order-id="order.id"
          :order="order"
          @updated="loadOrder"
        />
      </div>

      <!-- 右侧：订单操作日志时间线（仅电脑端显示） -->
      <div class="order-detail-sidebar">
        <OrderActivityTimeline
          v-if="order && order.activities"
          :activities="order.activities || []"
        />
      </div>
    </div>

    <!-- 编辑订单对话框 -->
    <OrderEditDialog
      v-if="order"
      v-model="editDialogVisible"
      :order="order"
      @success="loadOrder"
    />

    <!-- 催货对话框 -->
    <ReminderDialog
      v-model="reminderDialogVisible"
      :order-id="order?.id || null"
      @success="handleReminderSuccess"
    />

    <!-- 提交客户订单编号对话框 -->
    <el-dialog
      v-model="showCustomerNumberDialog"
      title="提交客户订单编号"
      width="500px"
    >
      <el-form :model="customerNumberForm" label-width="120px">
        <el-form-item label="客户订单编号" required>
          <el-input
            v-model="customerNumberForm.customer_order_number"
            placeholder="请输入客户订单编号"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCustomerNumberDialog = false">取消</el-button>
        <el-button type="primary" @click="submitCustomerNumber">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Right, DocumentCopy } from '@element-plus/icons-vue';
import { useAuthStore } from '../../stores/auth';
import { useOrdersStore } from '../../stores/orders';
import { ordersApi } from '../../api/orders';
import { useReminderStats } from '../../composables/useReminderStats';
import type { Order, OrderActivity } from '../../types';
// @ts-ignore - Vue SFC with script setup
import OrderEditDialog from '../../components/OrderEditDialog.vue';
// @ts-ignore - Vue SFC with script setup
import FollowUpRecord from '../../components/FollowUpRecord.vue';
// @ts-ignore - Vue SFC with script setup
import ReminderDialog from '../../components/ReminderDialog.vue';
// @ts-ignore - Vue SFC with script setup
import OrderActivityTimeline from '../../components/orders/OrderActivityTimeline.vue';
import { useWebSocket } from '../../composables/useWebSocket';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const ordersStore = useOrdersStore();

const loading = ref(false);
const editDialogVisible = ref(false);
const showCustomerNumberDialog = ref(false);
const reminderDialogVisible = ref(false);
const history = ref<any[]>([]);

// 催货统计管理
const reminderStats = useReminderStats();
const reminderCountdown = ref<number>(0);

const customerNumberForm = ref({
  customer_order_number: '',
});

const order = computed(() => ordersStore.currentOrder);

const handleBack = () => {
  // 如果历史记录中有上一页，则返回，否则跳转到订单列表
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push('/orders');
  }
};

const handleEditOrder = () => {
  if (!order.value || !order.value.id) {
    ElMessage.warning('订单信息不完整，无法编辑');
    return;
  }
  editDialogVisible.value = true;
};

const handleEditCustomerNumber = () => {
  if (!order.value) return;
  customerNumberForm.value.customer_order_number = order.value.customer_order_number || '';
  showCustomerNumberDialog.value = true;
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

const formatDate = (date: string) => {
  if (!date) return '-';
  return new Date(date).toLocaleString('zh-CN');
};

const formatDateOnly = (date: string) => {
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

const getAssignedNames = (target: Order | null | undefined) => {
  if (!target) return '';
  if (target.assigned_team?.length) {
    return target.assigned_team
      .map((member) => member.username || `ID ${member.id}`)
      .join('、');
  }
  if (target.assigned_to_names?.length) {
    return target.assigned_to_names.join('、');
  }
  if (target.assigned_to_name) {
    return target.assigned_to_name;
  }
  return '';
};

const getTrackingType = (type: string) => {
  const map: Record<string, string> = {
    main: 'success',
    supplement: 'warning',
    split_address: 'info',
    other: '',
  };
  return map[type] || '';
};

const getTrackingLabel = (type: string) => {
  const map: Record<string, string> = {
    main: '主单号',
    supplement: '补件单号',
    split_address: '分地址单号',
    other: '其他单号',
  };
  return map[type] || '单号';
};

const copyTrackingNumber = async (number: string) => {
  try {
    await navigator.clipboard.writeText(number);
    ElMessage.success(`已复制单号：${number}`);
  } catch (error) {
    ElMessage.error('复制失败，请手动复制');
  }
};

const loadOrder = async () => {
  const id = Number(route.params.id);
  if (!id) return;

  loading.value = true;
  try {
    await ordersStore.fetchOrderById(id);
    const historyResponse = await ordersApi.getOrderStatusHistory(id);
    history.value = historyResponse.history;
    
    // 如果是客户，加载催货统计
    if (authStore.isCustomer && order.value) {
      await reminderStats.fetchReminderStats(id);
      const stats = reminderStats.getReminderStats(id);
      if (stats && stats.next_reminder_time) {
        // 立即计算并设置初始剩余时间
        const initialRemaining = reminderStats.getRemainingSeconds(id);
        if (initialRemaining > 0) {
          reminderCountdown.value = initialRemaining;
        }
        // 启动倒计时
        reminderStats.startCountdown(id, (remaining) => {
          reminderCountdown.value = remaining;
        });
      } else {
        reminderCountdown.value = 0;
      }
    }
  } catch (error) {
    ElMessage.error('加载订单详情失败');
    router.push('/');
  } finally {
    loading.value = false;
  }
};

const handleReminder = () => {
  if (!order.value || !order.value.id) return;
  
  // 检查订单是否可以催货（已出货的订单不能催货）
  if (order.value.can_ship) {
    ElMessage.warning('订单已可出货，无需催货');
    return;
  }
  
  // 检查是否可以催货（节流检查）
  if (!reminderStats.canRemind(order.value.id)) {
    const remaining = reminderStats.getRemainingSeconds(order.value.id);
    const formatted = reminderStats.formatRemainingTime(remaining);
    ElMessage.warning(`催货过于频繁，请等待 ${formatted} 后再试`);
    return;
  }
  
  reminderDialogVisible.value = true;
};

const handleReminderSuccess = async () => {
  if (order.value?.id) {
    await reminderStats.refreshStats(order.value.id);
    reminderStats.startCountdown(order.value.id, (remaining) => {
      reminderCountdown.value = remaining;
    });
  }
};

const handleComplete = async () => {
  if (!order.value || !order.value.id) {
    ElMessage.warning('订单信息不完整，无法完成任务');
    return;
  }

  try {
    const result = await ElMessageBox.prompt('请输入完成备注（可选）', '完成任务', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputPlaceholder: '备注信息',
      inputType: 'textarea',
    });
    await ordersStore.completeOrder(order.value.id, result.value || undefined);
    ElMessage.success('订单已标记为完成');
    await loadOrder();
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('操作失败');
    }
  }
};

const submitCustomerNumber = async () => {
  if (!order.value || !customerNumberForm.value.customer_order_number) {
    ElMessage.warning('请输入客户订单编号');
    return;
  }

  try {
    await ordersApi.updateCustomerOrderNumber(
      order.value.id,
      customerNumberForm.value.customer_order_number
    );
    ElMessage.success('客户订单编号提交成功');
    showCustomerNumberDialog.value = false;
    customerNumberForm.value.customer_order_number = '';
    await loadOrder();
  } catch (error) {
    ElMessage.error('提交失败');
  }
};

// WebSocket 监听订单活动更新
const ws = useWebSocket();
let activityHandler: ((data: any) => void) | null = null;

onMounted(() => {
  loadOrder();
  
  // 监听订单活动更新
  const orderId = Number(route.params.id);
  if (orderId) {
    activityHandler = (data: any) => {
      if (data.type === 'order-activity-added' && data.activity?.order_id === orderId) {
        // 实时添加新活动
        if (order.value) {
          if (!order.value.activities) {
            order.value.activities = [];
          }
          // 检查是否已存在（避免重复添加）
          const exists = order.value.activities.some((a: OrderActivity) => a.id === data.activity.id);
          if (!exists) {
            order.value.activities.unshift(data.activity);
          }
        }
      }
    };
    ws.on(activityHandler);
  }
});

onUnmounted(() => {
  if (activityHandler) {
    ws.off(activityHandler);
  }
});
</script>

<style scoped>
.order-detail {
  width: 100%;
  padding: 0;
  max-width: 100%;
  overflow-x: hidden;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-content {
  padding: 10px 0;
  max-width: 100%;
  overflow-x: hidden;
}

h4 {
  margin: 0 0 10px 0;
  font-size: 16px;
  font-weight: 500;
  color: #303133;
}

.image-gallery {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.order-image {
  width: 150px;
  height: 150px;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid #dcdfe6;
}

.tracking-numbers {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.tracking-tag {
  cursor: pointer;
  padding: 8px 12px;
  font-size: 14px;
  transition: all 0.3s;
}

.tracking-tag:hover {
  opacity: 0.8;
  transform: scale(1.05);
}

.tracking-label {
  font-weight: 500;
  margin-right: 4px;
}

.tracking-number {
  font-family: 'Courier New', monospace;
  font-weight: bold;
}

.copy-icon {
  margin-left: 6px;
  font-size: 14px;
}

.empty-state {
  padding: 40px 0;
  text-align: center;
}

/* 订单详情布局：电脑端侧边栏，移动端垂直排列 */
.order-detail-layout {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-top: 20px;
}

.order-detail-main {
  flex: 1;
  min-width: 0; /* 防止 flex 子元素溢出 */
}

.order-detail-sidebar {
  width: 100%;
}

/* 电脑端：侧边栏布局 */
@media (min-width: 1024px) {
  .order-detail-layout {
    flex-direction: row;
    align-items: flex-start;
  }

  .order-detail-main {
    flex: 1;
    margin-right: 20px;
  }

  .order-detail-sidebar {
    width: 380px;
    flex-shrink: 0;
    position: sticky;
    top: 20px;
    max-height: calc(100vh - 40px);
    overflow-y: auto;
  }
}

/* 移动端优化 */
@media (max-width: 768px) {
  .order-detail {
    padding-bottom: 0;
    margin: 0;
    width: 100%;
    max-width: 100vw;
    overflow-x: hidden;
  }

  .order-detail :deep(.el-card) {
    margin: 0;
    border-radius: 0;
    box-shadow: none;
  }

  .order-detail :deep(.el-card__body) {
    padding: 15px;
  }

  .card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .card-header h3 {
    font-size: 18px;
    margin: 0;
  }

  .header-actions {
    width: 100%;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .header-actions .el-button {
    flex: 1;
    min-width: 0;
    min-height: 44px;
    font-size: 16px;
  }

  .detail-content {
    padding: 0;
    padding-bottom: 20px;
    width: 100%;
    max-width: 100%;
    overflow-x: hidden;
  }

  .detail-content :deep(.el-descriptions) {
    font-size: 14px;
    width: 100%;
    max-width: 100%;
    overflow-x: hidden;
  }

  .detail-content :deep(.el-descriptions__label) {
    width: 100px;
    font-size: 13px;
    word-break: break-word;
  }

  .detail-content :deep(.el-descriptions__content) {
    font-size: 13px;
    word-break: break-word;
    overflow-wrap: break-word;
  }

  .detail-content :deep(.el-descriptions) {
    --el-descriptions-table-border: 1px solid #ebeef5;
  }

  .detail-content :deep(.el-descriptions__table) {
    table-layout: fixed;
    width: 100%;
    max-width: 100%;
  }

  .detail-content :deep(.el-descriptions__table td),
  .detail-content :deep(.el-descriptions__table th) {
    padding: 12px 8px;
    word-break: break-word;
    overflow-wrap: break-word;
  }

  /* 移动端日期选择器优化 */
  .detail-content :deep(.el-date-editor) {
    width: 100% !important;
  }

  .detail-content :deep(.el-date-editor .el-input__inner) {
    font-size: 16px;
    min-height: 44px;
    padding: 12px 15px;
  }

  /* 日期选择器弹窗在移动端全屏显示 */
  .detail-content :deep(.el-picker__popper) {
    width: 100vw !important;
    left: 0 !important;
    right: 0 !important;
    margin: 0 !important;
    max-width: 100vw !important;
  }

  .detail-content :deep(.el-picker__panel) {
    width: 100% !important;
  }

  .order-image {
    width: 100px;
    height: 100px;
  }

  .tracking-tag {
    font-size: 13px;
    padding: 6px 10px;
  }

  .order-detail-layout {
    margin-top: 15px;
    gap: 15px;
  }

  /* 移动端隐藏侧边栏时间线，改为底部可滑动 */
  .order-detail-sidebar {
    position: relative;
    max-height: 400px;
    overflow-y: auto;
    border: 1px solid #ebeef5;
    border-radius: 4px;
    padding: 15px;
    background: #fff;
  }
}

/* 全局移动端按钮和输入框优化 */
@media (max-width: 768px) {
  :deep(.el-button) {
    min-height: 44px;
    font-size: 16px;
    padding: 12px 20px;
  }

  :deep(.el-button--small) {
    min-height: 36px;
    font-size: 14px;
    padding: 8px 16px;
  }

  :deep(.el-input__inner),
  :deep(.el-textarea__inner) {
    font-size: 16px;
    min-height: 44px;
    padding: 12px 15px;
  }

  :deep(.el-select .el-input__inner) {
    min-height: 44px;
  }

  :deep(.el-form-item__label) {
    font-size: 14px;
    line-height: 1.5;
  }

  :deep(.el-dialog) {
    width: 90% !important;
    margin: 5vh auto !important;
  }

  :deep(.el-dialog__body) {
    padding: 15px;
    max-height: calc(100vh - 200px);
    overflow-y: auto;
  }
}
</style>

