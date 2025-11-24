<template>
  <div class="follow-up-card-list" v-loading="loading">
    <transition-group name="follow-card" tag="div">
      <article
        v-for="item in summaries"
        :key="item.order_id"
        class="follow-card"
      >
        <header class="card-header">
          <div>
            <div class="order-number">
              <span class="label">订单</span>
              <span class="value">{{ item.order_number }}</span>
            </div>
            <div class="customer-info">
              <span v-if="item.company_name">{{ item.company_name }}</span>
              <span v-if="item.contact_name" class="contact">/ {{ item.contact_name }}</span>
            </div>
          </div>
          <el-tag :type="getStatusType(item.status)" size="small">
            {{ getStatusText(item.status) }}
          </el-tag>
        </header>

        <section class="card-body">
          <div class="preview">
            <el-image
              loading="lazy"
              v-if="item.images && item.images.length"
              :src="item.images[0]"
              :preview-src-list="item.images"
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
            <div v-else class="image-slot empty">暂无制单表</div>
          </div>
          <div class="info">
            <div class="info-item">
              <span class="label">跟进次数</span>
              <span class="value">{{ item.follow_up_count }}</span>
            </div>
            <div class="info-item">
              <span class="label">客户可见</span>
              <el-tag
                :type="item.has_customer_visible ? 'success' : 'info'"
                size="small"
              >
                {{ item.has_customer_visible ? '有' : '无' }}
              </el-tag>
            </div>
            <div class="info-item">
              <span class="label">最近跟进</span>
              <span class="value">{{ formatDateTime(item.last_follow_up_at) }}</span>
            </div>
          </div>
        </section>

        <footer class="card-actions">
          <el-button
            type="primary"
            size="small"
            plain
            @click="$emit('view', item.order_id)"
          >
            查看订单
          </el-button>
          <el-button
            type="success"
            size="small"
            plain
            @click="$emit('quick-follow-up', item.order_id)"
          >
            快速跟进
          </el-button>
        </footer>
      </article>
    </transition-group>
  </div>
</template>

<script setup lang="ts">
import { Picture } from '@element-plus/icons-vue';
import type { FollowUpSummary } from '../../api/followUps';

defineProps<{
  summaries: FollowUpSummary[];
  loading: boolean;
  formatDateTime: (value: string | null) => string;
  getStatusType: (status: string) => string;
  getStatusText: (status: string) => string;
}>();

defineEmits<{
  (e: 'view', orderId: number): void;
  (e: 'quick-follow-up', orderId: number): void;
}>();
</script>

<style scoped>
.follow-up-card-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.follow-card {
  border: 1px solid #e6ebf5;
  border-radius: 16px;
  padding: 16px;
  background: #fff;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.05);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.order-number .label {
  font-size: 12px;
  color: #909399;
  margin-right: 6px;
}

.order-number .value {
  font-size: 18px;
  font-weight: 600;
  color: #1f2d3d;
}

.customer-info {
  font-size: 13px;
  color: #606266;
  margin-top: 4px;
}

.customer-info .contact {
  color: #909399;
  margin-left: 4px;
}

.card-body {
  display: flex;
  gap: 12px;
}

.order-thumbnail {
  width: 84px;
  height: 84px;
  border-radius: 12px;
  object-fit: cover;
  border: 1px solid #edf2f7;
}

.image-slot {
  width: 84px;
  height: 84px;
  border-radius: 12px;
  border: 1px dashed #dcdfe6;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #c0c4cc;
  font-size: 12px;
}

.info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: #303133;
}

.info-item .label {
  color: #909399;
}

.card-actions {
  display: flex;
  gap: 10px;
}

.card-actions .el-button {
  flex: 1;
}

.follow-card-enter-active,
.follow-card-leave-active {
  transition: all 0.25s ease;
}

.follow-card-enter-from,
.follow-card-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@media (max-width: 480px) {
  .follow-card {
    padding: 14px;
  }

  .card-body {
    flex-direction: column;
  }

  .order-thumbnail,
  .image-slot {
    width: 100%;
    height: 180px;
  }
}
</style>

