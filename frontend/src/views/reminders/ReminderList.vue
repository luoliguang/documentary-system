<template>
  <div class="reminder-list">
    <el-card>
      <template #header>
        <h3>催货记录</h3>
      </template>

      <el-table
        v-loading="loading"
        :data="reminders"
        stripe
        style="width: 100%"
      >
        <el-table-column prop="order_number" label="订单编号" width="180" />
        <el-table-column
          v-if="authStore.isAdmin"
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
        <el-table-column prop="admin_response" label="管理员回复" min-width="200" show-overflow-tooltip />
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
        <el-table-column
          v-if="authStore.isAdmin"
          label="操作"
          width="120"
          fixed="right"
        >
          <template #default="{ row }">
            <el-button
              v-if="!row.is_resolved"
              type="primary"
              size="small"
              link
              @click="handleRespond(row)"
            >
              回复
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 回复对话框 -->
    <el-dialog
      v-model="respondDialogVisible"
      title="回复催货"
      width="600px"
    >
      <el-form :model="respondForm" label-width="100px">
        <el-form-item label="催货消息">
          <el-input
            v-model="currentReminder?.message"
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
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { useAuthStore } from '../../stores/auth';
import { remindersApi } from '../../api/reminders';
import type { DeliveryReminder } from '../../types';

const authStore = useAuthStore();
const loading = ref(false);
const reminders = ref<DeliveryReminder[]>([]);
const respondDialogVisible = ref(false);
const currentReminder = ref<DeliveryReminder | null>(null);

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

onMounted(() => {
  loadReminders();
});
</script>

<style scoped>
.reminder-list {
  width: 100%;
}
</style>

