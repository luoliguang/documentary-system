<template>
  <div class="reminder-list">
    <el-card>
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h3>{{ authStore.isCustomer ? '催单记录' : '催货记录' }}</h3>
          <div style="display: flex; gap: 8px;">
            <el-button 
              v-if="authStore.isCustomer"
              type="info" 
              size="small" 
              @click="feedbackDialogVisible = true"
            >
              <el-icon><QuestionFilled /></el-icon>
              找不到订单编号？
            </el-button>
            <el-button 
              v-if="canUseSearch"
              type="primary" 
              size="small" 
              @click="toggleSearchForm"
            >
              <el-icon><Search /></el-icon>
              {{ showSearchForm ? '收起搜索' : '展开搜索' }}
            </el-button>
          </div>
        </div>
      </template>

      <!-- 搜索表单 -->
      <el-collapse-transition v-if="canUseSearch">
        <div v-show="showSearchForm" class="search-form-container">
          <el-form :model="searchForm" inline class="search-form">
            <el-form-item label="工厂订单编号">
              <el-input
                v-model="searchForm.order_number"
                placeholder="请输入工厂订单编号"
                clearable
                style="width: 200px"
                @keyup.enter="handleSearch"
              />
            </el-form-item>
            <el-form-item label="客户订单编号">
              <el-input
                v-model="searchForm.customer_order_number"
                placeholder="请输入客户订单编号"
                clearable
                style="width: 200px"
                @keyup.enter="handleSearch"
              />
            </el-form-item>
            <el-form-item 
              v-if="authStore.canManageReminders" 
              label="客户公司"
            >
              <el-input
                v-model="searchForm.company_name"
                placeholder="请输入客户公司名称"
                clearable
                style="width: 200px"
                @keyup.enter="handleSearch"
              />
            </el-form-item>
            <el-form-item label="催单类型">
              <el-select
                v-model="searchForm.reminder_type"
                placeholder="请选择催单类型"
                clearable
                style="width: 150px"
              >
                <el-option label="普通" value="normal" />
                <el-option label="紧急" value="urgent" />
              </el-select>
            </el-form-item>
            <el-form-item label="处理状态">
              <el-select
                v-model="searchForm.is_resolved"
                placeholder="请选择处理状态"
                clearable
                style="width: 150px"
              >
                <el-option label="待处理" :value="false" />
                <el-option label="已处理" :value="true" />
              </el-select>
            </el-form-item>
            <el-form-item label="创建时间">
              <!-- 桌面端：使用日期范围选择器 -->
              <el-date-picker
                v-if="!createDateRange.isMobile.value"
                v-model="createDateRange.dateRange.value"
                type="daterange"
                range-separator="至"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
                value-format="YYYY-MM-DD"
                style="width: 240px"
                popper-class="mobile-date-picker-popper"
              />
              <!-- 手机端：使用两个独立的日期选择器 -->
              <div v-else class="mobile-date-range">
                <el-date-picker
                  v-model="createDateRange.dateStart.value"
                  type="date"
                  placeholder="开始日期"
                  value-format="YYYY-MM-DD"
                  class="mobile-date-picker"
                  popper-class="mobile-date-picker-popper"
                  style="width: 100%; margin-bottom: 8px;"
                />
                <el-date-picker
                  v-model="createDateRange.dateEnd.value"
                  type="date"
                  placeholder="结束日期"
                  value-format="YYYY-MM-DD"
                  class="mobile-date-picker"
                  popper-class="mobile-date-picker-popper"
                  style="width: 100%;"
                />
              </div>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="handleSearch">
                <el-icon><Search /></el-icon>
                搜索
              </el-button>
              <el-button @click="handleReset">
                <el-icon><Refresh /></el-icon>
                重置
              </el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-collapse-transition>

      <!-- 桌面端：表格 -->
      <el-table
        v-loading="loading"
        :data="reminders"
        stripe
        class="desktop-table"
        style="width: 100%"
      >
        <el-table-column label="工厂订单编号" width="200">
          <template #default="{ row }">
            <CopyText :text="row.order_number" />
          </template>
        </el-table-column>
        <el-table-column label="客户订单编号" width="200">
          <template #default="{ row }">
            <CopyText :text="row.customer_order_number" placeholder="-" />
          </template>
        </el-table-column>
        <el-table-column label="制单表" width="80" align="center">
          <template #default="{ row }">
            <el-image
              loading="lazy"
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
          v-if="authStore.canManageReminders"
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
        <el-table-column
          v-if="!authStore.isCustomer"
          label="转交信息"
          min-width="240"
        >
          <template #default="{ row }">
            <div v-if="row.last_transferred_to_name" class="transfer-info">
              <el-tag type="info" size="small">已转交</el-tag>
              <div class="transfer-meta">
                <span>给：{{ row.last_transferred_to_name }}</span>
                <span>操作者：{{ row.last_transferred_by_name || '系统' }}</span>
                <span>时间：{{ formatDate(row.last_transferred_at) }}</span>
              </div>
            </div>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
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
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="authStore.isCustomer && row.customer_id === authStore.user?.id && !row.is_resolved"
              type="primary"
              size="small"
              link
              @click="handleEditMessage(row)"
            >
              编辑消息
            </el-button>
            <el-button
              v-if="authStore.canManageReminders && row.admin_response"
              type="primary"
              size="small"
              link
              @click="handleEditResponse(row)"
            >
              编辑回复
            </el-button>
            <el-button
              v-if="authStore.canManageReminders && !row.is_resolved"
              type="primary"
              size="small"
              link
              @click="handleRespond(row)"
            >
              回复
            </el-button>
            <el-button
              v-if="(authStore.canManageReminders || authStore.isProductionManager) && row.order_id"
              type="success"
              size="small"
              link
              @click="openQuickAction(row.order_id)"
            >
              快速操作
            </el-button>
            <el-button
              v-if="authStore.canManageReminders || (authStore.isCustomer && row.customer_id === authStore.user?.id)"
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
            <div class="order-number">
              <CopyText :text="reminder.order_number" :inline="false" />
            </div>
            <div class="customer-order-number" v-if="reminder.customer_order_number">
              <CopyText
                :text="reminder.customer_order_number"
                :inline="false"
                label="客户编号"
              />
            </div>
            <div class="company-name" v-if="authStore.canManageReminders && reminder.company_name">
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
            <div
              v-if="!authStore.isCustomer && reminder.last_transferred_to_name"
              class="card-row transfer-info-mobile"
            >
              <span class="label">转交：</span>
              <span class="value">
                给 {{ reminder.last_transferred_to_name }}
                （{{ reminder.last_transferred_by_name || '系统' }} 于 {{ formatDate(reminder.last_transferred_at) }}）
              </span>
            </div>
            <div v-if="authStore.isCustomer && reminder.resolved_at" class="card-row">
              <span class="label">回复时间：</span>
              <span class="value">{{ formatDate(reminder.resolved_at) }}</span>
            </div>
          </div>

          <div class="card-actions">
            <el-button
              v-if="authStore.isCustomer && reminder.customer_id === authStore.user?.id && !reminder.is_resolved"
              type="primary"
              size="small"
              @click="handleEditMessage(reminder)"
            >
              编辑消息
            </el-button>
            <el-button
              v-if="authStore.canManageReminders && reminder.admin_response"
              type="primary"
              size="small"
              @click="handleEditResponse(reminder)"
            >
              编辑回复
            </el-button>
            <el-button
              v-if="authStore.canManageReminders && !reminder.is_resolved"
              type="primary"
              size="small"
              @click="handleRespond(reminder)"
            >
              回复
            </el-button>
            <el-button
              v-if="(authStore.canManageReminders || authStore.isProductionManager) && reminder.order_id"
              type="success"
              size="small"
              @click="openQuickAction(reminder.order_id)"
            >
              快速操作
            </el-button>
            <el-button
              v-if="authStore.canManageReminders || (authStore.isCustomer && reminder.customer_id === authStore.user?.id)"
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

    <!-- 编辑催货消息对话框 -->
    <el-dialog
      v-model="editMessageDialogVisible"
      title="编辑催货消息"
      :width="isMobile ? '90%' : '600px'"
    >
      <el-form :model="editMessageForm" label-width="100px">
        <el-form-item label="催货消息" required>
          <el-input
            v-model="editMessageForm.message"
            type="textarea"
            :rows="4"
            placeholder="请输入催货消息"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editMessageDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitEditMessage">确定</el-button>
      </template>
    </el-dialog>

    <!-- 编辑管理员回复对话框 -->
    <el-dialog
      v-model="editResponseDialogVisible"
      title="编辑管理员回复"
      :width="isMobile ? '90%' : '600px'"
    >
      <el-form :model="editResponseForm" label-width="100px">
        <el-form-item label="管理员回复" required>
          <el-input
            v-model="editResponseForm.admin_response"
            type="textarea"
            :rows="4"
            placeholder="请输入回复内容"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editResponseDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitEditResponse">确定</el-button>
      </template>
    </el-dialog>

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

    <!-- 订单编号反馈对话框 -->
    <OrderNumberFeedbackDialog
      v-model="feedbackDialogVisible"
      @success="handleFeedbackSuccess"
    />
  </div>

  <OrderQuickAction
    v-if="authStore.canManageReminders || authStore.isProductionManager"
    v-model="quickActionVisible"
    :order-id="quickActionOrderId"
    @success="handleQuickActionSuccess"
  />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Picture, Search, Refresh, QuestionFilled } from '@element-plus/icons-vue';
import { useMobileDateRange } from '../../composables/useMobileDateRange';
import { useAuthStore } from '../../stores/auth';
import { remindersApi } from '../../api/reminders';
import { useRemindersStore } from '../../stores/reminders';
import type { DeliveryReminder } from '../../types';
// @ts-ignore - Vue SFC with script setup
import OrderNumberFeedbackDialog from '../../components/OrderNumberFeedbackDialog.vue';
// @ts-ignore - Vue SFC with script setup
import OrderQuickAction from '../../components/OrderQuickAction.vue';
// @ts-ignore - Vue SFC with script setup
import CopyText from '../../components/common/CopyText.vue';

const authStore = useAuthStore();
const remindersStore = useRemindersStore();
remindersStore.initRealtime();
const reminders = computed(() => remindersStore.reminders);
const loading = remindersStore.isLoading;
const respondDialogVisible = ref(false);
const currentReminder = ref<DeliveryReminder | null>(null);
// 桌面端默认展开，手机端默认收起
const showSearchForm = ref(window.innerWidth > 768);
const editMessageDialogVisible = ref(false);
const editResponseDialogVisible = ref(false);
const feedbackDialogVisible = ref(false);
const quickActionVisible = ref(false);
const quickActionOrderId = ref<number | null>(null);

// 搜索表单
// 使用手机端日期范围 composable
const createDateRange = useMobileDateRange();

const searchForm = ref({
  order_number: '',
  customer_order_number: '',
  company_name: '',
  reminder_type: undefined as 'normal' | 'urgent' | undefined,
  is_resolved: undefined as boolean | undefined,
  dateRange: [] as string[], // 保留用于兼容
});

// 同步 composable 的数据到 searchForm（用于兼容）
watch(
  () => createDateRange.dateRange.value,
  (range) => {
    searchForm.value.dateRange = range;
  },
  { immediate: true }
);

// 反向同步：从 searchForm 同步到 composable
watch(
  () => searchForm.value.dateRange,
  (range) => {
    if (JSON.stringify(range) !== JSON.stringify(createDateRange.dateRange.value)) {
      createDateRange.dateRange.value = range;
    }
  }
);

// 移动端检测
const isMobile = ref(window.innerWidth <= 768);

const canUseSearch = computed(() => {
  if (authStore.isProductionManager && isMobile.value) {
    return false;
  }
  return true;
});

const toggleSearchForm = () => {
  if (!canUseSearch.value) {
    return;
  }
  showSearchForm.value = !showSearchForm.value;
};

const checkMobile = () => {
  const width = window.innerWidth;
  isMobile.value = width <= 768;
};

watch(canUseSearch, (value) => {
  if (!value) {
    showSearchForm.value = false;
    return;
  }
  if (!isMobile.value) {
    showSearchForm.value = true;
  }
});

const respondForm = ref({
  admin_response: '',
});

const editMessageForm = ref({
  message: '',
});

const editResponseForm = ref({
  admin_response: '',
});

const formatDate = (date?: string | null) => {
  if (!date) return '-';
  return new Date(date).toLocaleString('zh-CN');
};

const buildReminderQuery = () => {
  const params: any = {};
  if (searchForm.value.order_number) {
    params.order_number = searchForm.value.order_number;
  }
  if (searchForm.value.customer_order_number) {
    params.customer_order_number = searchForm.value.customer_order_number;
  }
  if (searchForm.value.company_name) {
    params.company_name = searchForm.value.company_name;
  }
  if (searchForm.value.reminder_type) {
    params.reminder_type = searchForm.value.reminder_type;
  }
  if (searchForm.value.is_resolved !== undefined) {
    params.is_resolved = searchForm.value.is_resolved;
  }
  const { start, end } = createDateRange.buildQueryParams({
    startTime: '00:00:00',
    endTime: '23:59:59',
  });
  if (start) {
    params.start_date = start.split(' ')[0];
  }
  if (end) {
    params.end_date = end.split(' ')[0];
  }
  return params;
};

const loadReminders = async (options?: { force?: boolean }) => {
  try {
    await remindersStore.fetchReminders(buildReminderQuery(), options);
  } catch (error) {
    ElMessage.error('加载催货记录失败');
  }
};

const handleSearch = () => {
  loadReminders({ force: true });
};

const handleFeedbackSuccess = () => {
  // 反馈提交成功后的处理（可选：刷新列表等）
};

const handleReset = () => {
  searchForm.value = {
    order_number: '',
    customer_order_number: '',
    company_name: '',
    reminder_type: undefined,
    is_resolved: undefined,
    dateRange: [],
  };
  createDateRange.reset();
  loadReminders({ force: true });
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
    const response = await remindersApi.respondToReminder(currentReminder.value.id, {
      admin_response: respondForm.value.admin_response,
      is_resolved: true,
    });
    ElMessage.success('回复成功');
    respondDialogVisible.value = false;
    remindersStore.upsertReminder(response.reminder);
  } catch (error) {
    ElMessage.error('回复失败');
  }
};

const handleEditMessage = (reminder: DeliveryReminder) => {
  currentReminder.value = reminder;
  editMessageForm.value.message = reminder.message || '';
  editMessageDialogVisible.value = true;
};

const submitEditMessage = async () => {
  if (!currentReminder.value || !editMessageForm.value.message) {
    ElMessage.warning('请输入催货消息');
    return;
  }

  try {
    const response = await remindersApi.updateReminderMessage(currentReminder.value.id, {
      message: editMessageForm.value.message,
    });
    ElMessage.success('催货消息更新成功');
    editMessageDialogVisible.value = false;
    remindersStore.upsertReminder(response.reminder);
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '更新失败');
  }
};

const handleEditResponse = (reminder: DeliveryReminder) => {
  currentReminder.value = reminder;
  editResponseForm.value.admin_response = reminder.admin_response || '';
  editResponseDialogVisible.value = true;
};

const submitEditResponse = async () => {
  if (!currentReminder.value || !editResponseForm.value.admin_response) {
    ElMessage.warning('请输入回复内容');
    return;
  }

  try {
    const response = await remindersApi.updateAdminResponse(currentReminder.value.id, {
      admin_response: editResponseForm.value.admin_response,
    });
    ElMessage.success('管理员回复更新成功');
    editResponseDialogVisible.value = false;
    remindersStore.upsertReminder(response.reminder);
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '更新失败');
  }
};

const handleDelete = async (reminder: DeliveryReminder) => {
  try {
    await ElMessageBox.confirm(
      '确定要删除这条催货记录吗？删除后将从列表中隐藏，但不会影响催货次数统计。',
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );

    await remindersApi.deleteReminder(reminder.id);
    ElMessage.success('催货记录删除成功');
    remindersStore.removeReminder(reminder.id);
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.error || '删除催货记录失败');
    }
  }
};

const openQuickAction = (orderId: number) => {
  quickActionOrderId.value = orderId;
  quickActionVisible.value = true;
};

const handleQuickActionSuccess = () => {
  quickActionVisible.value = false;
  loadReminders({ force: true });
};

onMounted(() => {
  checkMobile();
  window.addEventListener('resize', checkMobile);
  loadReminders({ force: true });
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

.transfer-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.transfer-meta {
  font-size: 12px;
  color: #909399;
  display: flex;
  flex-direction: column;
  gap: 2px;
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

.transfer-info-mobile {
  flex-direction: column;
}

.transfer-info-mobile .value {
  display: block;
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

/* 搜索表单样式 */
.search-form-container {
  margin-bottom: 20px;
  padding: 20px;
  background: #f5f7fa;
  border-radius: 4px;
  border: 1px solid #ebeef5;
}

.search-form {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.search-form .el-form-item {
  margin-bottom: 0;
}

@media (max-width: 768px) {
  .search-form {
    flex-direction: column;
  }
  
  .search-form .el-form-item {
    width: 100%;
  }
  
  .search-form .el-input,
  .search-form .el-select,
  .search-form .el-date-picker {
    width: 100% !important;
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
}
</style>

