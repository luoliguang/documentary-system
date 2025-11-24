<template>
  <div class="order-mobile-list" v-loading="loading">
    <transition-group name="order-card" tag="div">
      <el-card
        v-for="order in orders"
        :key="order.id"
        class="order-card"
        shadow="hover"
        @click="handleCardClick(order.id)"
      >
        <!-- 第1行：制单图 + 订单号 + 编辑/分配按钮 -->
        <div class="card-row row-1">
          <div class="thumbnail-wrapper" @click.stop="handleImageClick()">
            <el-image
              loading="lazy"
              v-if="order.images && order.images.length > 0"
              :src="order.images[0]"
              :preview-src-list="order.images"
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
            <div v-else class="image-slot empty">暂无制单图</div>
          </div>
          <div class="order-number">{{ order.order_number }}</div>
          <div class="action-buttons" v-if="auth.canManageOrders">
            <el-button
              circle
              size="small"
              class="icon-btn"
              @click.stop="emit('quick-edit', order)"
            >
              <el-icon><EditPen /></el-icon>
            </el-button>
            <el-button
              circle
              size="small"
              :type="order.assigned_to_ids?.length ? 'success' : 'default'"
              class="icon-btn"
              @click.stop="emit('assign', order)"
            >
              <el-icon><User /></el-icon>
            </el-button>
          </div>
        </div>

        <!-- 第2行：客户公司名 + 状态标签 + 箭头 -->
        <div class="card-row row-2">
          <span class="company-name">{{ order.company_name || '未设置' }}</span>
          <el-tag
            :type="getStatusType(order.status)"
            :class="{ 'urgent-tag': isUrgentStatus(order.status) }"
            size="small"
          >
            {{ getStatusText(order.status) }}
          </el-tag>
          <div class="arrow-icon" @click.stop="handleCardClick(order.id)">
            <el-icon><Right /></el-icon>
          </div>
        </div>

        <!-- 第3行：预计出货日期（延误标红） -->
        <div class="card-row row-3">
          <span class="ship-date-label">预计出货：</span>
          <span
            class="ship-date-value"
            :class="{ 'delayed': isDelayed(order) }"
          >
            {{ formatShipDate(order.estimated_ship_date) }}
            <span v-if="getDelayDays(order) > 0" class="delay-badge">
              延误{{ getDelayDays(order) }}天
            </span>
          </span>
        </div>

        <!-- 第4行：两个超大开关 -->
        <div class="card-row row-4">
          <div class="switch-item">
            <span class="switch-label">已完成</span>
            <el-switch
              v-if="auth.canManageOrders || auth.isProductionManager"
              v-model="order.is_completed"
              size="large"
              class="large-switch"
              @change="emit('update-completed', order)"
              @click.stop
            />
            <el-tag v-else :type="order.is_completed ? 'success' : 'info'" size="small">
              {{ order.is_completed ? '是' : '否' }}
            </el-tag>
          </div>
          <div class="switch-item">
            <span class="switch-label">可出货</span>
            <el-switch
              v-if="auth.canManageOrders || auth.isProductionManager"
              v-model="order.can_ship"
              size="large"
              class="large-switch"
              @change="emit('update-can-ship', order)"
              @click.stop
            />
            <el-tag v-else :type="order.can_ship ? 'success' : 'info'" size="small">
              {{ order.can_ship ? '是' : '否' }}
            </el-tag>
          </div>
        </div>
      </el-card>
    </transition-group>
  </div>
</template>

<script setup lang="ts">
import { Picture, EditPen, User, Right } from '@element-plus/icons-vue';
import type { Order } from '../../types';

interface AuthFlags {
  canManageOrders: boolean;
  canManageReminders: boolean;
  isProductionManager: boolean;
  isCustomer: boolean;
}

interface OrderStatusOption {
  label: string;
  value: string;
}

withDefaults(
  defineProps<{
    loading?: boolean;
    orders: Order[];
    auth: AuthFlags;
    orderStatuses: OrderStatusOption[];
    getStatusType: (status: string) => string;
    getStatusText: (status: string) => string;
    formatDateTime: (value: string) => string;
    getOrderReminderCount: (orderId: number) => number;
    getOrderAssignmentCount: (orderId: number) => number;
    reminderStats?: {
      canRemind: (orderId: number) => boolean;
      formatRemainingTime: (seconds: number) => string;
    };
    getReminderCountdown: (orderId: number) => number;
  }>(),
  {
    loading: false,
    reminderStats: undefined,
  }
);

const emit = defineEmits<{
  (e: 'view', orderId: number): void;
  (e: 'quick-edit', order: Order): void;
  (e: 'complete', orderId: number): void;
  (e: 'assign', order: Order): void;
  (e: 'delete', order: Order): void;
  (e: 'reminder', orderId: number): void;
  (e: 'update-status', order: Order): void;
  (e: 'update-completed', order: Order): void;
  (e: 'update-can-ship', order: Order): void;
  (e: 'update-estimated-ship-date', payload: { order: Order; value: string | null }): void;
}>();

const handleCardClick = (orderId: number) => {
  emit('view', orderId);
};

const handleImageClick = () => {
  // 图片点击事件由 el-image 的 preview 功能处理
};

const formatShipDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '未设置';
  try {
    const date = new Date(dateStr);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day} ${hours}:${minutes}`;
  } catch {
    return '日期格式错误';
  }
};

const isDelayed = (order: Order): boolean => {
  if (!order.estimated_ship_date) return false;
  try {
    const shipDate = new Date(order.estimated_ship_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    shipDate.setHours(0, 0, 0, 0);
    return shipDate < today && !order.is_completed;
  } catch {
    return false;
  }
};

const getDelayDays = (order: Order): number => {
  if (!order.estimated_ship_date || order.is_completed) return 0;
  try {
    const shipDate = new Date(order.estimated_ship_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    shipDate.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - shipDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  } catch {
    return 0;
  }
};

const isUrgentStatus = (status: string): boolean => {
  const urgentStatuses = ['urgent', 'overdue', 'delayed'];
  return urgentStatuses.includes(status.toLowerCase());
};
</script>

<style scoped>
.order-mobile-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0;
}

.order-card {
  height: 130px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 6px;
}

.order-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.order-card :deep(.el-card__body) {
  padding: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 10px;
}

.card-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* 第1行：制单图 + 订单号 + 按钮 */
.row-1 {
  height: 36px;
  justify-content: space-between;
}

.thumbnail-wrapper {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 4px;
  overflow: visible;
  cursor: pointer;
  min-width: 48px;
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  box-sizing: border-box;
}

.order-thumbnail {
  width: 36px;
  height: 36px;
  border-radius: 4px;
  object-fit: cover;
}

.image-slot {
  width: 36px;
  height: 36px;
  border-radius: 4px;
  border: 1px dashed #dcdfe6;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #c0c4cc;
  font-size: 10px;
  background: #f5f7fa;
}

.image-slot.empty {
  font-size: 10px;
  letter-spacing: 0.5px;
}

.order-number {
  flex: 1;
  font-size: 18px;
  font-weight: 700;
  color: #1f2d3d;
  text-align: left;
  margin-left: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action-buttons {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.icon-btn {
  min-width: 48px;
  min-height: 48px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-btn :deep(.el-icon) {
  font-size: 16px;
}

/* 第2行：客户公司名 + 状态标签 + 箭头 */
.row-2 {
  height: 24px;
  justify-content: space-between;
}

.company-name {
  flex: 1;
  font-size: 13px;
  color: #606266;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 8px;
}

.urgent-tag {
  background-color: #f56c6c !important;
  border-color: #f56c6c !important;
  color: #fff !important;
}

.arrow-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  color: #909399;
  transition: color 0.2s;
}

.arrow-icon:hover {
  color: #409eff;
}

.arrow-icon :deep(.el-icon) {
  font-size: 20px;
}

/* 第3行：预计出货日期 */
.row-3 {
  height: 22px;
  justify-content: flex-start;
  gap: 6px;
}

.ship-date-label {
  font-size: 12px;
  color: #909399;
  flex-shrink: 0;
}

.ship-date-value {
  font-size: 12px;
  color: #303133;
  display: flex;
  align-items: center;
  gap: 6px;
}

.ship-date-value.delayed {
  color: #f56c6c;
  font-weight: 600;
}

.delay-badge {
  background: #f56c6c;
  color: #fff;
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 600;
  white-space: nowrap;
}

/* 第4行：两个超大开关 */
.row-4 {
  height: 32px;
  justify-content: space-between;
  gap: 12px;
}

.switch-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #f5f7fa;
  padding: 6px 10px;
  border-radius: 6px;
  min-height: 48px;
}

.switch-label {
  font-size: 14px;
  color: #303133;
  font-weight: 500;
  flex-shrink: 0;
}

.large-switch {
  flex-shrink: 0;
}

.large-switch :deep(.el-switch__core) {
  width: 50px;
  height: 28px;
  min-width: 50px;
}

.large-switch :deep(.el-switch__core::after) {
  width: 24px;
  height: 24px;
}

.large-switch :deep(.el-switch.is-checked .el-switch__core::after) {
  margin-left: -24px;
}

/* 过渡动画 */
.order-card-enter-active,
.order-card-leave-active {
  transition: all 0.25s ease;
}

.order-card-enter-from,
.order-card-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

/* 移动端优化 */
@media (max-width: 768px) {
  .order-mobile-list {
    gap: 6px;
  }

  .order-card {
    height: 200px;
    padding: 8px 10px;
    gap: 10px;
    margin-bottom: 7px !important;
  }

  .row-1 {
    height: 36px;
  }

  .row-2 {
    height: 24px;
  }

  .row-3 {
    height: 22px;
  }

  .row-4 {
    height: 32px;
  }

  .order-number {
    font-size: 17px;
  }

  .company-name {
    font-size: 12px;
  }

  .switch-label {
    font-size: 13px;
  }
}

@media (max-width: 480px) {
  .order-card {
    height: 200px;
    padding: 8px 10px;
    gap: 10px;
    margin-bottom: 7px !important;
  }

  .order-number {
    font-size: 16px;
  }

  .company-name {
    font-size: 11px;
  }

  .switch-label {
    font-size: 12px;
  }

  .large-switch :deep(.el-switch__core) {
    width: 48px;
    height: 26px;
  }

  .large-switch :deep(.el-switch__core::after) {
    width: 22px;
    height: 22px;
  }
}
</style>
