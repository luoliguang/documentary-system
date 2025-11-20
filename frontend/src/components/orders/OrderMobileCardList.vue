<template>
  <div class="order-mobile-list" v-loading="loading">
    <transition-group name="order-card" tag="div">
      <article
        v-for="order in orders"
        :key="order.id"
        class="order-card"
      >
        <header class="card-header">
          <div class="header-main">
            <div class="order-no">
              <span class="label">订单</span>
              <span class="value">{{ order.order_number }}</span>
            </div>
            <div v-if="order.customer_order_number" class="customer-no">
              客户：{{ order.customer_order_number }}
            </div>
          </div>
          <div class="header-right">
            <el-tag :type="getStatusType(order.status)" size="small">
              {{ getStatusText(order.status) }}
            </el-tag>
            <el-badge
              v-if="getOrderReminderCount(order.id) > 0"
              :value="getOrderReminderCount(order.id)"
              type="danger"
            />
            <el-badge
              v-if="getOrderAssignmentCount(order.id) > 0"
              :value="getOrderAssignmentCount(order.id)"
              type="primary"
            />
          </div>
        </header>

        <section class="card-preview">
          <el-image
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

          <div class="status-summary">
            <div class="status-item">
              <span class="title">完成</span>
              <el-switch
                v-if="auth.isAdmin || auth.isProductionManager"
                v-model="order.is_completed"
                size="small"
                @change="emit('update-completed', order)"
              />
              <el-tag v-else :type="order.is_completed ? 'success' : 'info'" size="small">
                {{ order.is_completed ? '是' : '否' }}
              </el-tag>
            </div>
            <div class="status-item">
              <span class="title">可出货</span>
              <el-switch
                v-if="auth.isAdmin || auth.isProductionManager"
                v-model="order.can_ship"
                size="small"
                @change="emit('update-can-ship', order)"
              />
              <el-tag v-else :type="order.can_ship ? 'success' : 'info'" size="small">
                {{ order.can_ship ? '是' : '否' }}
              </el-tag>
            </div>
          </div>
        </section>

        <section class="card-meta">
          <div
            v-if="auth.isAdmin || auth.isProductionManager"
            class="meta-line"
          >
            <span class="meta-label">生产跟单</span>
            <span class="meta-value">{{ getAssignedNames(order) || '未分配' }}</span>
          </div>
          <div v-if="auth.isAdmin && order.company_name" class="meta-line">
            <span class="meta-label">客户公司</span>
            <span class="meta-value">{{ order.company_name }}</span>
          </div>
          <div class="meta-line">
            <span class="meta-label">预计出货</span>
            <div class="meta-control">
              <el-date-picker
                v-if="auth.isAdmin || auth.isProductionManager"
                v-model="order.estimated_ship_date"
                type="datetime"
                placeholder="选择日期时间"
                size="small"
                class="date-picker"
                value-format="YYYY-MM-DD HH:mm:ss"
                format="YYYY-MM-DD HH:mm"
                @change="(val: string | null) => emit('update-estimated-ship-date', { order, value: val })"
              />
              <span v-else>{{ formatDateTime(order.estimated_ship_date || '') }}</span>
            </div>
          </div>
          <div v-if="order.notes" class="meta-line">
            <span class="meta-label">备注</span>
            <span class="meta-value notes">{{ order.notes }}</span>
          </div>
        </section>

        <section
          v-if="auth.isAdmin"
          class="card-control"
        >
          <div class="control-item">
            <span class="meta-label">状态</span>
            <el-select
              v-model="order.status"
              size="small"
              class="status-select"
              @change="emit('update-status', order)"
            >
              <el-option
                v-for="status in orderStatuses"
                :key="status.value"
                :label="status.label"
                :value="status.value"
              />
            </el-select>
          </div>
        </section>

        <section
          v-if="auth.isCustomer || auth.isAdmin || auth.isProductionManager"
          class="card-reminder"
        >
          <div class="reminder-info" v-if="auth.isCustomer">
            <div class="reminder-title">催货状态</div>
            <div class="reminder-desc">
              <span v-if="order.can_ship">已可出货</span>
              <span v-else-if="reminderStats && !reminderStats.canRemind(order.id)">
                再等 {{ reminderStats?.formatRemainingTime(getReminderCountdown(order.id)) }}
              </span>
              <span v-else>可立即催货</span>
            </div>
          </div>
          <el-button
            v-if="auth.isCustomer"
            type="warning"
            size="small"
            plain
            :disabled="order.can_ship || (reminderStats && !reminderStats.canRemind(order.id))"
            @click="emit('reminder', order.id)"
          >
            催货
          </el-button>
        </section>

        <footer class="card-actions">
          <el-button type="primary" size="small" @click="emit('view', order.id)">
            查看
          </el-button>
          <el-button
            v-if="auth.isAdmin"
            type="success"
            size="small"
            @click="emit('quick-edit', order)"
          >
            编辑
          </el-button>
          <el-button
            v-if="auth.isAdmin && !order.is_completed"
            type="success"
            size="small"
            @click="emit('complete', order.id)"
          >
            完成
          </el-button>
          <el-button
            v-if="auth.isAdmin"
            :type="order.assigned_to_ids?.length ? 'success' : 'info'"
            size="small"
            @click="emit('assign', order)"
          >
            {{ order.assigned_to_ids?.length ? '已分配' : '分配' }}
          </el-button>
          <el-button
            v-if="auth.isAdmin"
            type="danger"
            size="small"
            @click="emit('delete', order)"
          >
            删除
          </el-button>
        </footer>
      </article>
    </transition-group>
  </div>
</template>

<script setup lang="ts">
import { Picture } from '@element-plus/icons-vue';
import type { Order } from '../../types';

interface AuthFlags {
  isAdmin: boolean;
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

const getAssignedNames = (order: Order): string => {
  if (order.assigned_team?.length) {
    return order.assigned_team
      .map((member) => member.username || `ID ${member.id}`)
      .join('、');
  }
  if (order.assigned_to_names?.length) {
    return order.assigned_to_names.join('、');
  }
  if (order.assigned_to_name) {
    return order.assigned_to_name;
  }
  return '';
};

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
</script>

<style scoped>
.order-mobile-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.order-card {
  background: #fff;
  border: 1px solid #e9edf5;
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.order-no .label {
  font-size: 12px;
  color: #909399;
  margin-right: 6px;
}

.order-no .value {
  font-size: 18px;
  font-weight: 600;
  color: #1f2d3d;
}

.customer-no {
  font-size: 13px;
  color: #606266;
  margin-top: 4px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.card-preview {
  display: flex;
  gap: 12px;
}

.order-thumbnail {
  width: 96px;
  height: 96px;
  border-radius: 12px;
  object-fit: cover;
  border: 1px solid #f0f2f5;
  flex-shrink: 0;
}

.image-slot {
  width: 96px;
  height: 96px;
  border-radius: 12px;
  border: 1px dashed #dcdfe6;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #c0c4cc;
  font-size: 13px;
  flex-shrink: 0;
}

.image-slot.empty {
  font-size: 12px;
  letter-spacing: 1px;
}

.status-summary {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.status-item {
  background: #f9fafc;
  border-radius: 10px;
  padding: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid #eef2f7;
}

.status-item .title {
  font-size: 13px;
  color: #606266;
}

.card-meta {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.meta-line {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
  color: #303133;
}

.meta-label {
  color: #909399;
  min-width: 70px;
  font-size: 12px;
}

.meta-value {
  flex: 1;
  text-align: right;
}

.meta-value.notes {
  color: #606266;
  line-height: 1.5;
}

.meta-control {
  flex: 1;
  text-align: right;
}

.date-picker {
  width: 100%;
}

.card-control {
  border-top: 1px dashed #e5e9f2;
  padding-top: 12px;
}

.control-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.status-select {
  width: 100%;
}

.card-reminder {
  border-radius: 12px;
  padding: 12px;
  background: #fff7e6;
  border: 1px solid #ffe3ba;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.reminder-title {
  font-weight: 600;
  color: #d48806;
  font-size: 13px;
}

.reminder-desc {
  color: #ad6800;
  font-size: 12px;
}

.card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.card-actions .el-button {
  flex: 1;
  min-width: 100px;
}

.order-card-enter-active,
.order-card-leave-active {
  transition: all 0.25s ease;
}

.order-card-enter-from,
.order-card-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@media (max-width: 480px) {
  .order-card {
    padding: 14px;
  }

  .card-preview {
    flex-direction: column;
  }

  .status-summary {
    grid-template-columns: 1fr;
  }

  .meta-line {
    flex-direction: column;
    align-items: flex-start;
  }

  .meta-value,
  .meta-control {
    text-align: left;
  }

  .card-actions .el-button {
    min-width: 48%;
  }
}
</style>

