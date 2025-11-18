<template>
  <div class="reminder-list">
    <el-card>
      <template #header>
        <h3>{{ authStore.isCustomer ? '催单记录' : '催货记录' }}</h3>
      </template>

      <!-- 桌面端：表格 -->
      <el-table
        v-loading="loading"
        :data="reminders"
        stripe
        class="desktop-table"
        style="width: 100%"
      >
        <el-table-column prop="order_number" label="订单编号" width="180" />
        <el-table-column label="制单表" width="80" align="center">
          <template #default="{ row }">
            <el-image
              v-if="row.images && row.images.length > 0"
              :src="row.images[0]"
              :preview-src-list="row.images"
              :initial-index="0"
              fit="cover"
              class="reminder-thumbnail"
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
        <el-table-column
          v-if="authStore.isAdmin || authStore.isProductionManager"
          prop="company_name"
          label="客户公司"
          width="200"
        />
        <el-table-column prop="reminder_type" label="催货类型" width="120">
          <template #default="{ row }">
            <el-tag :type="row.reminder_type === 'urgent' ? 'danger' : 'warning'">
              {{ row.reminder_type === 'urgent' ? '紧急' : '普通' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="message" label="催货消息" min-width="200" show-overflow-tooltip />
        <el-table-column prop="admin_response" :label="authStore.isCustomer ? '管理员/生产跟单回复' : '管理员回复'" min-width="200" show-overflow-tooltip />
        <el-table-column prop="is_resolved" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.is_resolved ? 'success' : 'info'">
              {{ row.is_resolved ? '已处理' : '待处理' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column v-if="authStore.isCustomer" prop="resolved_at" label="回复时间" width="180">
          <template #default="{ row }">
            <span v-if="row.resolved_at">{{ formatDate(row.resolved_at) }}</span>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="authStore.isAdmin && !row.is_resolved"
              type="primary"
              size="small"
              link
              @click="handleRespond(row)"
            >
              回复
            </el-button>
            <el-button
              v-if="authStore.isAdmin || (authStore.isCustomer && row.customer_id === authStore.user?.id)"
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

      <!-- 移动端：卡片列表 -->
      <div v-loading="loading" class="mobile-card-list">
        <div
          v-for="reminder in reminders"
          :key="reminder.id"
          class="reminder-card"
        >
          <div class="card-header-section">
            <div class="card-image-section">
              <el-image
                v-if="reminder.images && reminder.images.length > 0"
                :src="reminder.images[0]"
                :preview-src-list="reminder.images"
                :initial-index="0"
                fit="cover"
                class="reminder-thumbnail-mobile"
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
              <div class="order-number">{{ reminder.order_number }}</div>
              <div class="company-name" v-if="(authStore.isAdmin || authStore.isProductionManager) && reminder.company_name">
                {{ reminder.company_name }}
              </div>
            </div>
            <div class="card-badges">
              <el-tag :type="reminder.reminder_type === 'urgent' ? 'danger' : 'warning'" size="small">
                {{ reminder.reminder_type === 'urgent' ? '紧急' : '普通' }}
              </el-tag>
              <el-tag :type="reminder.is_resolved ? 'success' : 'info'" size="small">
                {{ reminder.is_resolved ? '已处理' : '待处理' }}
              </el-tag>
            </div>
          </div>

          <div class="card-content">
            <div class="card-row" v-if="reminder.message">
              <span class="label">催货消息：</span>
              <span class="value">{{ reminder.message }}</span>
            </div>
            <div class="card-row" v-if="reminder.admin_response">
              <span class="label">{{ authStore.isCustomer ? '管理员/生产跟单回复：' : '管理员回复：' }}</span>
              <span class="value">{{ reminder.admin_response }}</span>
            </div>
            <div class="card-row">
              <span class="label">创建时间：</span>
              <span class="value">{{ formatDate(reminder.created_at) }}</span>
            </div>
            <div v-if="authStore.isCustomer && reminder.resolved_at" class="card-row">
              <span class="label">回复时间：</span>
              <span class="value">{{ formatDate(reminder.resolved_at) }}</span>
            </div>
          </div>

          <div class="card-actions">
            <el-button
              v-if="authStore.isAdmin && !reminder.is_resolved"
              type="primary"
              size="small"
              @click="handleRespond(reminder)"
            >
              回复
            </el-button>
            <el-button
              v-if="authStore.isAdmin || (authStore.isCustomer && reminder.customer_id === authStore.user?.id)"
              type="danger"
              size="small"
              @click="handleDelete(reminder)"
            >
              删除
            </el-button>
          </div>
        </div>
      </div>
    </el-card>

    <!-- 回复对话框 -->
    <el-dialog
      v-model="respondDialogVisible"
      title="回复催货"
      :width="isMobile ? '90%' : '600px'"
      class="respond-dialog"
    >
      <el-form :model="respondForm" label-width="100px">
        <el-form-item label="催货消息">
          <el-input
            :value="currentReminder?.message || ''"
            type="textarea"
            :rows="3"
            readonly
          />
        </el-form-item>
        <el-form-item label="管理员回复" required>
          <el-input
            v-model="respondForm.admin_response"
            type="textarea"
            :rows="4"
            placeholder="请输入回复内容"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="respondDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitRespond">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Picture } from '@element-plus/icons-vue';
import { useAuthStore } from '../../stores/auth';
import { remindersApi } from '../../api/reminders';
import type { DeliveryReminder } from '../../types';

const authStore = useAuthStore();
const loading = ref(false);
const reminders = ref<DeliveryReminder[]>([]);
const respondDialogVisible = ref(false);
const currentReminder = ref<DeliveryReminder | null>(null);

// 移动端检测
const isMobile = ref(window.innerWidth <= 768);

const checkMobile = () => {
  isMobile.value = window.innerWidth <= 768;
};

const respondForm = ref({
  admin_response: '',
});

const formatDate = (date: string) => {
  if (!date) return '-';
  return new Date(date).toLocaleString('zh-CN');
};

const loadReminders = async () => {
  loading.value = true;
  try {
    const response = await remindersApi.getDeliveryReminders();
    reminders.value = response.reminders;
  } catch (error) {
    ElMessage.error('加载催货记录失败');
  } finally {
    loading.value = false;
  }
};

const handleRespond = (reminder: DeliveryReminder) => {
  currentReminder.value = reminder;
  respondForm.value.admin_response = '';
  respondDialogVisible.value = true;
};

const submitRespond = async () => {
  if (!currentReminder.value || !respondForm.value.admin_response) {
    ElMessage.warning('请输入回复内容');
    return;
  }

  try {
    await remindersApi.respondToReminder(currentReminder.value.id, {
      admin_response: respondForm.value.admin_response,
      is_resolved: true,
    });
    ElMessage.success('回复成功');
    respondDialogVisible.value = false;
    await loadReminders();
  } catch (error) {
    ElMessage.error('回复失败');
  }
};

const handleDelete = async (reminder: DeliveryReminder) => {
  try {
    await ElMessageBox.confirm(
      '确定要删除这条催货记录吗？此操作无法恢复。',
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );

    await remindersApi.deleteReminder(reminder.id);
    ElMessage.success('催货记录删除成功');
    await loadReminders();
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('删除催货记录失败');
    }
  }
};

onMounted(() => {
  checkMobile();
  window.addEventListener('resize', checkMobile);
  loadReminders();
});

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile);
});
</script>

<style scoped>
.reminder-list {
  width: 100%;
}

/* 桌面端表格图片 */
.reminder-thumbnail {
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

.reminder-card {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  padding: 15px;
  margin-bottom: 15px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.card-header-section {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 15px;
  padding-bottom: 15px;
  border-bottom: 1px solid #ebeef5;
  gap: 12px;
}

.card-image-section {
  flex-shrink: 0;
}

.reminder-thumbnail-mobile {
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

.company-name {
  font-size: 14px;
  color: #606266;
  word-break: break-all;
}

.card-badges {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
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
  /* 移动端隐藏表格，显示卡片 */
  .desktop-table {
    display: none !important;
  }

  .mobile-card-list {
    display: block;
  }

  .card-header-section {
    flex-direction: row;
    align-items: flex-start;
  }

  .card-image-section {
    flex-shrink: 0;
  }

  .card-title-section {
    flex: 1;
    margin-right: 10px;
  }

  .card-badges {
    flex-direction: column;
    flex-shrink: 0;
    gap: 6px;
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

  .company-name {
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

.text-muted {
  color: #909399;
  font-size: 14px;
}
</style>

