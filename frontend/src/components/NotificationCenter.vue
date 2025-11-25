<template>
  <el-drawer
    v-model="visible"
    title="通知中心"
    :size="isMobile ? '90%' : '400px'"
    direction="rtl"
  >
    <div class="notification-center">
      <!-- 操作栏 -->
      <div class="notification-actions">
        <el-select
          v-model="filterStatus"
          size="small"
          style="width: 120px"
          @change="handleFilterChange"
        >
          <el-option label="全部" value="all" />
          <el-option label="未读" value="unread" />
          <el-option label="已读" value="read" />
        </el-select>
        <el-checkbox
          v-model="selectAll"
          :indeterminate="isIndeterminate"
          @change="handleSelectAll"
          style="margin-left: 8px;"
        >
          全选
        </el-checkbox>
        <el-button
          v-if="notificationsStore.hasUnread"
          type="primary"
          size="small"
          @click="handleMarkAllAsRead"
        >
          全部标记为已读
        </el-button>
        <el-button
          v-if="selectedNotifications.length > 0"
          type="danger"
          size="small"
          @click="handleBatchDelete"
        >
          批量删除 ({{ selectedNotifications.length }})
        </el-button>
        <el-button
          size="small"
          @click="handleRefresh"
          :loading="notificationsStore.loading"
        >
          刷新
        </el-button>
      </div>

      <!-- 通知列表 -->
      <div v-loading="notificationsStore.loading" class="notification-list">
        <div
          v-if="notificationsStore.notifications.length === 0"
          class="empty-state"
        >
          <el-empty description="暂无通知" />
        </div>
        <div
          v-for="notification in notificationsStore.notifications"
          :key="notification.id"
          :class="['notification-item', { unread: !notification.is_read }]"
        >
          <el-checkbox
            :model-value="selectedNotifications.includes(notification.id)"
            @update:model-value="(val: boolean) => {
              if (val) {
                if (!selectedNotifications.includes(notification.id)) {
                  selectedNotifications.push(notification.id);
                }
              } else {
                const index = selectedNotifications.indexOf(notification.id);
                if (index > -1) {
                  selectedNotifications.splice(index, 1);
                }
              }
            }"
            @click.stop
            style="margin-right: 8px;"
          />
          <div
            class="notification-content-wrapper"
            @click="handleNotificationClick(notification)"
          >
          <div class="notification-header">
            <div class="notification-title">
              <el-icon
                :class="[
                  'notification-icon',
                  getNotificationIconClass(notification.type),
                ]"
              >
                <Bell v-if="notification.type === 'reminder'" />
                <QuestionFilled v-else-if="getNotificationIconClass(notification.type) === 'feedback-icon'" />
                <User v-else />
              </el-icon>
              <span>{{ notification.title }}</span>
            </div>
            <el-tag
              v-if="!notification.is_read"
              type="danger"
              size="small"
              effect="plain"
            >
              未读
            </el-tag>
          </div>
          <div class="notification-content">
            {{ notification.content || '无内容' }}
          </div>
          <div class="notification-footer">
            <span class="notification-time">
              {{ formatTime(notification.created_at) }}
            </span>
            <div class="notification-actions">
              <!-- 催单通知：管理员可以分配/重新分配任务 -->
              <el-button
                v-if="notification.type === 'reminder' && authStore.canManageOrders && notification.related_type === 'order'"
                :type="orderAssignmentStatus[notification.related_id || 0] ? 'warning' : 'primary'"
                size="small"
                @click.stop="handleAssignOrder(notification)"
              >
                {{ orderAssignmentStatus[notification.related_id || 0] ? '重新分配' : '分配订单' }}
              </el-button>
              <!-- 催单通知：生产跟单可以转交催单（只有分配给自己的催单才能转交） -->
              <el-button
                v-if="notification.type === 'reminder' && authStore.isProductionManager && notification.related_type === 'order'"
                type="success"
                size="small"
                @click.stop="handleTransferReminder(notification)"
              >
                转交催单
              </el-button>
              <!-- 分配通知：生产跟单可以快速操作 -->
              <el-button
                v-if="notification.type === 'assignment' && authStore.isProductionManager && notification.related_type === 'order'"
                type="primary"
                size="small"
                @click.stop="handleQuickAction(notification)"
              >
                快速操作
              </el-button>
              <el-button
                v-if="notification.type === 'reminder' && (authStore.canManageReminders || authStore.isProductionManager) && notification.related_type === 'order'"
                type="success"
                size="small"
                @click.stop="handleQuickAction(notification)"
              >
                快速操作
              </el-button>
              <!-- 订单编号反馈通知：管理员/客服可以创建订单 -->
              <el-button
                v-if="(notification.type === 'order_feedback' as any) && authStore.canManageOrders"
                type="primary"
                size="small"
                @click.stop="handleCreateOrderFromFeedback(notification)"
              >
                创建订单
              </el-button>
              <el-button
                v-if="!notification.is_read"
                type="text"
                size="small"
                @click.stop="handleMarkAsRead(notification.id)"
              >
                标记已读
              </el-button>
              <el-button
                v-if="notification.is_read"
                type="text"
                size="small"
                danger
                @click.stop="handleDelete(notification.id)"
              >
                删除
              </el-button>
            </div>
          </div>
          </div>
        </div>
      </div>

      <!-- 分页 -->
      <div v-if="pagination.totalPages > 1" class="notification-pagination">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="pagination.total"
          :page-sizes="[10, 20, 50]"
          layout="prev, pager, next, sizes"
          :small="isMobile"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </div>

    <!-- 快速操作对话框 -->
    <OrderQuickAction
      v-if="authStore.isProductionManager"
      v-model="quickActionVisible"
      :order-id="quickActionOrderId"
      @success="handleQuickActionSuccess"
    />

    <!-- 分配订单对话框 -->
    <OrderAssignDialog
      v-if="authStore.canManageOrders"
      v-model="assignDialogVisible"
      :order-id="assignOrderId"
      @success="handleAssignSuccess"
    />

    <!-- 转交催单对话框 -->
    <ReminderTransferDialog
      v-if="authStore.isProductionManager"
      v-model="transferDialogVisible"
      :reminder-id="transferReminderId"
      :order-id="transferOrderId"
      @success="handleTransferSuccess"
    />
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Bell, User, QuestionFilled } from '@element-plus/icons-vue';
import { useAuthStore } from '../stores/auth';
import { useNotificationsStore } from '../stores/notifications';
import type { Notification } from '../types';
// @ts-ignore - Vue SFC with script setup
import OrderQuickAction from './OrderQuickAction.vue';
// @ts-ignore - Vue SFC with script setup
import OrderAssignDialog from './OrderAssignDialog.vue';
// @ts-ignore - Vue SFC with script setup
import ReminderTransferDialog from './ReminderTransferDialog.vue';
import { ordersApi } from '../api/orders';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const router = useRouter();
const authStore = useAuthStore();
const notificationsStore = useNotificationsStore();

const quickActionVisible = ref(false);
const quickActionOrderId = ref<number | null>(null);
const assignDialogVisible = ref(false);
const assignOrderId = ref<number | null>(null);
const transferDialogVisible = ref(false);
const transferReminderId = ref<number | null>(null);
const transferOrderId = ref<number | null>(null);
const filterStatus = ref<'all' | 'unread' | 'read'>('all');
const selectedNotifications = ref<number[]>([]);
const selectAll = ref(false);
const orderAssignmentCache = ref<Map<number, boolean>>(new Map());
const orderAssignmentStatus = computed(() => {
  const status: Record<number, boolean> = {};
  orderAssignmentCache.value.forEach((value, key) => {
    status[key] = value;
  });
  return status;
});

// 计算全选状态
const isIndeterminate = computed(() => {
  const total = notificationsStore.notifications.length;
  const selected = selectedNotifications.value.length;
  return selected > 0 && selected < total;
});

// 监听选中状态，更新全选状态
watch(selectedNotifications, (newVal) => {
  const total = notificationsStore.notifications.length;
  selectAll.value = total > 0 && newVal.length === total;
}, { deep: true });

// 监听通知列表变化，更新全选状态
watch(() => notificationsStore.notifications, () => {
  const total = notificationsStore.notifications.length;
  selectAll.value = total > 0 && selectedNotifications.value.length === total;
}, { deep: true });

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const isMobile = ref(window.innerWidth <= 768);
const currentPage = ref(1);
const pageSize = ref(20);
const pagination = ref({
  total: 0,
  page: 1,
  pageSize: 20,
  totalPages: 0,
});

// 监听抽屉打开，加载通知
watch(visible, (newVal) => {
  if (newVal) {
    orderAssignmentCache.value.clear();
    loadNotifications();
  }
});

const loadNotifications = async () => {
  try {
    const isRead = filterStatus.value === 'all' 
      ? undefined 
      : filterStatus.value === 'read';
    
    const response = await notificationsStore.fetchNotifications({
      page: currentPage.value,
      pageSize: pageSize.value,
      is_read: isRead,
    });
    pagination.value = response.pagination;
    
    // 只有管理员/客服需要加载订单分配状态（用于显示"分配订单"或"重新分配"按钮）
    // 客户不需要看到分配按钮，所以不需要加载订单分配状态
    if (authStore.canManageOrders) {
      orderAssignmentCache.value.clear();
      const orderIds = new Set<number>();
      notificationsStore.notifications.forEach((n) => {
        if (n.type === 'reminder' && n.related_type === 'order' && n.related_id) {
          orderIds.add(n.related_id);
        }
      });
      
      // 批量加载订单分配状态
      await Promise.all(
        Array.from(orderIds).map((orderId) => loadOrderAssignmentStatus(orderId))
      );
    }
  } catch (error) {
    // 错误已在store中处理
  }
};

const handleFilterChange = () => {
  currentPage.value = 1;
  selectedNotifications.value = []; // 切换筛选时清空选中
  selectAll.value = false; // 重置全选状态
  loadNotifications();
};

const handleRefresh = () => {
  loadNotifications();
  notificationsStore.fetchUnreadCount();
};

const handleMarkAsRead = async (id: number) => {
  try {
    await notificationsStore.markAsRead(id);
    ElMessage.success('已标记为已读');
  } catch (error) {
    // 错误已在store中处理
  }
};

const handleMarkAllAsRead = async () => {
  try {
    await notificationsStore.markAllAsRead();
  } catch (error) {
    // 错误已在store中处理
  }
};

const handleNotificationClick = (notification: Notification) => {
  // 如果未读，先标记为已读
  if (!notification.is_read) {
    handleMarkAsRead(notification.id);
  }

  // 根据通知类型和用户角色处理
  if (notification.type === 'order_feedback' && authStore.canManageOrders) {
    // 订单编号反馈通知：跳转到创建订单页面
    handleCreateOrderFromFeedback(notification);
    return;
  }

  if (notification.related_type === 'order' && notification.related_id) {
    // 如果是分配通知且是生产跟单，打开快速操作而不是跳转
    if (notification.type === 'assignment' && authStore.isProductionManager) {
      handleQuickAction(notification);
      return;
    }
    // 其他情况跳转到订单详情
    router.push(`/orders/${notification.related_id}`);
    visible.value = false;
  } else if (notification.related_type === 'reminder' && notification.related_id) {
    router.push('/reminders');
    visible.value = false;
  } else if (notification.type === 'order_feedback') {
    // 客户点击反馈通知，跳转到反馈列表
    router.push('/order-feedbacks');
    visible.value = false;
  }
};

// 处理分配订单
const handleAssignOrder = async (notification: Notification) => {
  if (notification.related_type === 'order' && notification.related_id) {
    // 如果未读，先标记为已读
    if (!notification.is_read) {
      await handleMarkAsRead(notification.id);
    }
    assignOrderId.value = notification.related_id;
    assignDialogVisible.value = true;
  }
};

// 处理快速操作
const handleQuickAction = async (notification: Notification) => {
  if (notification.related_type === 'order' && notification.related_id) {
    // 如果未读，先标记为已读
    if (!notification.is_read) {
      await handleMarkAsRead(notification.id);
    }
    quickActionOrderId.value = notification.related_id;
    quickActionVisible.value = true;
  }
};

// 分配成功回调
const handleAssignSuccess = () => {
  assignDialogVisible.value = false;
  loadNotifications();
  notificationsStore.fetchUnreadCount();
};

// 快速操作成功回调
const handleQuickActionSuccess = () => {
  quickActionVisible.value = false;
  loadNotifications();
  notificationsStore.fetchUnreadCount();
};

// 删除通知
const handleDelete = async (id: number) => {
  try {
    await ElMessageBox.confirm(
      '确定要删除这条通知吗？此操作无法恢复。',
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );

    await notificationsStore.deleteNotification(id);
    // 从选中列表中移除
    const index = selectedNotifications.value.indexOf(id);
    if (index > -1) {
      selectedNotifications.value.splice(index, 1);
    }
    ElMessage.success('删除成功');
    await loadNotifications();
    notificationsStore.fetchUnreadCount();
  } catch (error: any) {
    if (error !== 'cancel') {
      // 错误已在store中处理
    }
  }
};

// 全选/取消全选
const handleSelectAll = (checked: boolean) => {
  if (checked) {
    selectedNotifications.value = notificationsStore.notifications.map(n => n.id);
  } else {
    selectedNotifications.value = [];
  }
};

// 批量删除通知
const handleBatchDelete = async () => {
  if (selectedNotifications.value.length === 0) {
    ElMessage.warning('请选择要删除的通知');
    return;
  }

  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${selectedNotifications.value.length} 条通知吗？此操作无法恢复。`,
      '确认批量删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );
    await notificationsStore.deleteNotificationsBatch(selectedNotifications.value);
    selectedNotifications.value = [];
    selectAll.value = false;
    await loadNotifications();
    notificationsStore.fetchUnreadCount();
  } catch (error: any) {
    if (error !== 'cancel') {
      // 错误已在store中处理
    }
  }
};

const handleSizeChange = () => {
  currentPage.value = 1;
  loadNotifications();
};

const handlePageChange = () => {
  loadNotifications();
};


// 加载订单分配状态
const loadOrderAssignmentStatus = async (orderId: number) => {
  if (orderAssignmentCache.value.has(orderId)) {
    return orderAssignmentCache.value.get(orderId) || false;
  }
  try {
    const response = await ordersApi.getOrderById(orderId);
    const isAssigned = !!(response.order.assigned_to || (response.order.assigned_to_ids && response.order.assigned_to_ids.length > 0));
    orderAssignmentCache.value.set(orderId, isAssigned);
    return isAssigned;
  } catch (error) {
    console.error('加载订单分配状态失败:', error);
    return false;
  }
};

// 处理转交催单
const handleTransferReminder = async (notification: Notification) => {
  if (notification.related_type === 'order' && notification.related_id) {
    // 如果未读，先标记为已读
    if (!notification.is_read) {
      await handleMarkAsRead(notification.id);
    }
    
    // 从订单查询最新的未处理催单
    try {
      const { remindersApi } = await import('../api/reminders');
      const { ordersApi } = await import('../api/orders');
      
      const currentUserId = authStore.user?.id;
      if (!currentUserId) {
        ElMessage.error('用户信息不存在');
        return;
      }
      
      // 先检查订单是否已分配给当前生产跟单
      const orderResponse = await ordersApi.getOrderById(notification.related_id);
      const isOrderAssignedToMe = 
        orderResponse.order.assigned_to === currentUserId ||
        (orderResponse.order.assigned_to_ids && orderResponse.order.assigned_to_ids.includes(currentUserId));
      
      if (!isOrderAssignedToMe) {
        ElMessage.warning('该订单未分配给您，无法转交催单');
        return;
      }
      
      // 查询该订单的未处理催单
      const remindersResponse = await remindersApi.getDeliveryReminders({
        order_id: notification.related_id,
        is_resolved: false,
      });
      
      // 查找可转交的催单：
      // 1. 已分配给当前生产跟单的催单
      // 2. 订单已分配给当前生产跟单，但催单未分配（客户创建的催单）
      // 3. 订单已分配给当前生产跟单，催单已分配给其他生产跟单（这种情况不应该转交，但为了完整性也检查）
      const assignedReminder = remindersResponse.reminders.find(
        (r) => {
          // 如果订单已分配给当前生产跟单，则可以转交该订单的所有未处理催单
          // 包括：已分配给自己的、未分配的、或已分配给其他生产跟单的（虽然不应该转交，但允许）
          if (!isOrderAssignedToMe) {
            return false; // 订单未分配给自己，不能转交
          }
          if (r.is_resolved) {
            return false; // 已处理的催单不能转交
          }
          // 如果催单已分配给当前生产跟单，或者催单未分配，都可以转交
          return r.assigned_to === currentUserId || !r.assigned_to;
        }
      );
      
      if (!assignedReminder) {
        // 如果订单已分配但没有找到可转交的催单，可能是所有催单都已分配给其他生产跟单
        const hasOtherAssignedReminders = remindersResponse.reminders.some(
          (r) => r.assigned_to && r.assigned_to !== currentUserId && !r.is_resolved
        );
        if (hasOtherAssignedReminders) {
          ElMessage.warning('该订单的催单已分配给其他生产跟单，无法转交');
        } else {
          ElMessage.warning('未找到可转交的催单');
        }
        return;
      }
      
      transferOrderId.value = notification.related_id;
      transferReminderId.value = assignedReminder.id;
      transferDialogVisible.value = true;
    } catch (error: any) {
      console.error('加载催单信息失败:', error);
      const errorMessage = error.response?.data?.error || error.message || '加载催单信息失败';
      ElMessage.error(errorMessage);
    }
  }
};

// 转交成功回调
const handleTransferSuccess = () => {
  transferDialogVisible.value = false;
  loadNotifications();
  notificationsStore.fetchUnreadCount();
  // 清除缓存，重新加载
  orderAssignmentCache.value.clear();
};

// 处理从订单编号反馈创建订单
const handleCreateOrderFromFeedback = (notification: Notification) => {
  if (notification.type === 'order_feedback' && notification.related_id) {
    router.push(`/orders/create?feedback_id=${notification.related_id}`);
    visible.value = false;
  }
};

const getNotificationIconClass = (type: string) => {
  if (type === 'reminder') return 'reminder-icon';
  if (type === 'order_feedback') return 'feedback-icon';
  if (type === 'assignment') return 'assignment-icon';
  return 'assignment-icon';
};

const formatTime = (time: string) => {
  if (!time) return '';
  const date = new Date(time);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) {
    return '刚刚';
  } else if (minutes < 60) {
    return `${minutes}分钟前`;
  } else if (hours < 24) {
    return `${hours}小时前`;
  } else if (days < 7) {
    return `${days}天前`;
  } else {
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
};
</script>

<style scoped>
.notification-center {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.notification-actions {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid #ebeef5;
  margin-bottom: 10px;
}

.notification-list {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
}

.notification-item {
  padding: 15px;
  border-bottom: 1px solid #ebeef5;
  transition: background 0.3s;
  background: #fff;
  display: flex;
  align-items: flex-start;
}

.notification-content-wrapper {
  flex: 1;
  cursor: pointer;
}

.notification-item:hover {
  background: #f5f7fa;
}

.notification-item.unread {
  background: #fef0f0;
  border-left: 3px solid #f56c6c;
}

.notification-item.unread:hover {
  background: #fde2e2;
}

.notification-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.notification-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
  color: #303133;
  flex: 1;
}

.notification-icon {
  font-size: 16px;
}

.reminder-icon {
  color: #f56c6c;
}

.assignment-icon {
  color: #409eff;
}

.feedback-icon {
  color: #e6a23c;
}

.notification-content {
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
  margin-bottom: 8px;
  white-space: pre-wrap;
  word-break: break-word;
}

.notification-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #909399;
  flex-wrap: wrap;
  gap: 8px;
}

.notification-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.notification-time {
  flex: 1;
}

.notification-pagination {
  padding: 15px 0;
  border-top: 1px solid #ebeef5;
  display: flex;
  justify-content: center;
}

@media (max-width: 768px) {
  .notification-item {
    padding: 12px;
  }

  .notification-title {
    font-size: 13px;
  }

  .notification-content {
    font-size: 12px;
  }
}
</style>

