<template>
  <el-dialog
    :model-value="modelValue"
    title="提交催货"
    width="500px"
    @update:model-value="updateValue"
  >
    <el-form :model="form" label-width="100px">
      <el-form-item label="催货类型" required>
        <el-radio-group v-model="form.reminder_type">
          <el-radio label="normal">普通</el-radio>
          <el-radio label="urgent">紧急</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="催货消息">
        <el-input
          v-model="form.message"
          type="textarea"
          :rows="4"
          placeholder="请输入催货消息（可选）"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="updateValue(false)">取消</el-button>
      <el-button type="primary" :loading="loading" @click="handleSubmit">
        提交
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { remindersApi } from '../api/reminders';
import { useRemindersStore } from '../stores/reminders';

interface Props {
  modelValue: boolean;
  orderId?: number | null;
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
  (e: 'success'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const loading = ref(false);
const remindersStore = useRemindersStore();
const form = reactive({
  reminder_type: 'normal' as 'normal' | 'urgent',
  message: '',
});

const updateValue = (value: boolean) => {
  emit('update:modelValue', value);
};

watch(() => props.modelValue, (newVal) => {
  if (!newVal) {
    // 重置表单
    form.reminder_type = 'normal';
    form.message = '';
  }
});

const formatNextReminderTime = (isoString?: string | null): string | null => {
  if (!isoString) return null;
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleString('zh-CN', {
    hour12: false,
  });
};

const handleSubmit = async () => {
  if (!props.orderId) {
    ElMessage.warning('订单ID不能为空');
    return;
  }

  loading.value = true;
  try {
    const response = await remindersApi.createDeliveryReminder({
      order_id: props.orderId,
      reminder_type: form.reminder_type,
      message: form.message || undefined,
    });
    ElMessage.success('催货申请已提交');
    if (response?.reminder) {
      remindersStore.upsertReminder(response.reminder);
    }
    updateValue(false);
    emit('success');
  } catch (error: any) {
    const status = error?.response?.status;
    const data = error?.response?.data;
    if (status === 429) {
      const formatted = formatNextReminderTime(data?.next_reminder_time);
      if (formatted) {
        ElMessage.warning(`催货过于频繁，请在 ${formatted} 后再试`);
      } else {
        ElMessage.warning(data?.error || '催货过于频繁，请稍后再试');
      }
    } else {
      ElMessage.error(data?.error || '提交失败');
    }
  } finally {
    loading.value = false;
  }
};
</script>

