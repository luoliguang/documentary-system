<template>
  <div class="follow-up-record">
    <el-card>
      <template #header>
        <div class="card-header">
          <div class="card-title">
            <h3>跟进记录</h3>
            <span v-if="isCustomer" class="customer-hint">
              仅展示对客户开放的跟进记录
            </span>
          </div>
          <div class="card-actions">
            <el-button size="small" @click="loadFollowUps" :loading="loading">
              刷新
            </el-button>
            <el-button
              v-if="canManageFollowUps"
              type="primary"
              size="small"
              @click="showAddDialog = true"
            >
              添加跟进记录
            </el-button>
          </div>
        </div>
      </template>

      <div v-if="loadError" class="error-state">
        <el-alert
          :title="loadError"
          type="error"
          show-icon
          :closable="false"
        >
          <template #default>
            <div class="error-actions">
              <el-button type="text" @click="loadFollowUps">重新加载</el-button>
            </div>
          </template>
        </el-alert>
      </div>

      <div v-loading="loading" class="follow-up-list">
        <div v-if="displayedFollowUps.length === 0 && !loadError" class="empty-state">
          <el-empty
            :description="
              isCustomer
                ? '暂无对客户开放的跟进记录'
                : '暂无跟进记录'
            "
          />
        </div>
        <div
          v-for="followUp in displayedFollowUps"
          :key="followUp.id"
          class="follow-up-item"
        >
          <div class="follow-up-header">
            <div class="follow-up-info">
              <span class="follow-up-author">
                {{ followUp.production_manager_name || '生产跟单' }}
              </span>
              <el-tag
                v-if="followUp.is_visible_to_customer"
                type="success"
                size="small"
                effect="plain"
              >
                客户可见
              </el-tag>
              <el-tag
                v-else
                type="info"
                size="small"
                effect="plain"
              >
                仅内部可见
              </el-tag>
            </div>
            <div class="follow-up-actions">
              <span class="follow-up-time">
                {{ formatTime(followUp.created_at) }}
              </span>
              <el-button
                v-if="
                  authStore.isProductionManager &&
                  followUp.production_manager_id === authStore.user?.id
                "
                type="text"
                size="small"
                @click="handleEdit(followUp)"
              >
                编辑
              </el-button>
              <el-button
                v-if="
                  authStore.isProductionManager &&
                  followUp.production_manager_id === authStore.user?.id
                "
                type="text"
                size="small"
                danger
                @click="handleDelete(followUp)"
              >
                删除
              </el-button>
            </div>
          </div>
          <div class="follow-up-content">
            {{ followUp.content }}
          </div>
        </div>
      </div>
    </el-card>

    <!-- 添加/编辑跟进记录对话框 -->
    <el-dialog
      v-model="showAddDialog"
      :title="editingFollowUp ? '编辑跟进记录' : '添加跟进记录'"
      :width="isMobile ? '90%' : '600px'"
    >
      <el-form :model="followUpForm" label-width="100px">
        <el-form-item label="跟进内容" required>
          <el-input
            v-model="followUpForm.content"
            type="textarea"
            :rows="6"
            placeholder="请输入跟进情况"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
        <el-form-item>
          <el-checkbox v-model="followUpForm.is_visible_to_customer">
            对客户可见
          </el-checkbox>
          <div style="font-size: 12px; color: #909399; margin-top: 4px">
            勾选后，客户可以在订单详情中看到此跟进记录
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" @click="submitFollowUp" :loading="submitting">
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useAuthStore } from '../stores/auth';
import { followUpsApi, type FollowUp } from '../api/followUps';
import type { Order } from '../types';

const props = defineProps<{
  orderId: number;
  order?: Order | null;
}>();

const emit = defineEmits<{
  updated: [];
}>();

const authStore = useAuthStore();
const loading = ref(false);
const loadError = ref<string | null>(null);
const submitting = ref(false);
const followUps = ref<FollowUp[]>([]);
const showAddDialog = ref(false);
const editingFollowUp = ref<FollowUp | null>(null);
const isMobile = ref(window.innerWidth <= 768);

const isProductionManager = computed(() => authStore.isProductionManager);
const isCustomer = computed(() => authStore.isCustomer);
const canManageFollowUps = computed(
  () =>
    authStore.isAdmin ||
    (isProductionManager.value &&
      props.order?.assigned_to === authStore.user?.id)
);

const followUpForm = ref({
  content: '',
  is_visible_to_customer: true,
});

const displayedFollowUps = computed(() => {
  if (isCustomer.value) {
    return followUps.value.filter((item) => item.is_visible_to_customer);
  }
  return followUps.value;
});

// 定义加载跟进记录函数（必须在 watch 之前定义）
const loadFollowUps = async () => {
  if (!props.orderId || props.orderId <= 0) return;

  loading.value = true;
  loadError.value = null;
  try {
    const response = await followUpsApi.getOrderFollowUps(props.orderId);
    followUps.value = response.followUps;
  } catch (error: any) {
    console.error('加载跟进记录失败:', error);
    loadError.value =
      error?.response?.data?.error || '加载跟进记录失败，请稍后重试';
  } finally {
    loading.value = false;
  }
};

// 监听订单ID变化，加载跟进记录
watch(
  () => props.orderId,
  (newOrderId) => {
    if (newOrderId && newOrderId > 0) {
      loadFollowUps();
    }
  },
  { immediate: true }
);

const handleEdit = (followUp: FollowUp) => {
  editingFollowUp.value = followUp;
  followUpForm.value.content = followUp.content;
  followUpForm.value.is_visible_to_customer = followUp.is_visible_to_customer;
  showAddDialog.value = true;
};

const handleDelete = async (followUp: FollowUp) => {
  try {
    await ElMessageBox.confirm(
      '确定要删除这条跟进记录吗？此操作无法恢复。',
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );

    await followUpsApi.deleteFollowUp(followUp.id);
    ElMessage.success('删除成功');
    await loadFollowUps();
    emit('updated');
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败');
    }
  }
};

const submitFollowUp = async () => {
  if (!followUpForm.value.content.trim()) {
    ElMessage.warning('请输入跟进内容');
    return;
  }

  submitting.value = true;
  try {
    if (editingFollowUp.value) {
      // 更新跟进记录
      await followUpsApi.updateFollowUp(editingFollowUp.value.id, {
        content: followUpForm.value.content.trim(),
        is_visible_to_customer: followUpForm.value.is_visible_to_customer,
      });
      ElMessage.success('更新成功');
    } else {
      // 创建跟进记录
      await followUpsApi.createFollowUp({
        order_id: props.orderId,
        content: followUpForm.value.content.trim(),
        is_visible_to_customer: followUpForm.value.is_visible_to_customer,
      });
      ElMessage.success('添加成功');
    }

    showAddDialog.value = false;
    editingFollowUp.value = null;
    followUpForm.value.content = '';
    followUpForm.value.is_visible_to_customer = true;
    await loadFollowUps();
    emit('updated');
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '操作失败');
  } finally {
    submitting.value = false;
  }
};

// 监听对话框关闭，重置表单
watch(showAddDialog, (newVal) => {
  if (!newVal) {
    editingFollowUp.value = null;
    followUpForm.value.content = '';
    followUpForm.value.is_visible_to_customer = true;
  }
});

const formatTime = (time: string) => {
  if (!time) return '';
  const date = new Date(time);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};
</script>

<style scoped>
.follow-up-record {
  margin-top: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-title h3 {
  margin: 0;
  font-size: 16px;
}

.customer-hint {
  font-size: 12px;
  color: #909399;
}

.card-actions {
  display: flex;
  gap: 8px;
}

.follow-up-list {
  min-height: 100px;
}

.empty-state {
  padding: 40px 0;
}

.follow-up-item {
  padding: 15px;
  border-bottom: 1px solid #ebeef5;
  transition: background 0.3s;
}

.follow-up-item:last-child {
  border-bottom: none;
}

.follow-up-item:hover {
  background: #f5f7fa;
}

.follow-up-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.follow-up-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.follow-up-author {
  font-weight: 600;
  color: #303133;
}

.follow-up-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.follow-up-time {
  font-size: 12px;
  color: #909399;
}

.follow-up-content {
  color: #606266;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.error-state {
  margin-bottom: 16px;
}

.error-actions {
  margin-top: 10px;
}

@media (max-width: 768px) {
  .follow-up-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .follow-up-actions {
    width: 100%;
    justify-content: space-between;
  }
}
</style>

