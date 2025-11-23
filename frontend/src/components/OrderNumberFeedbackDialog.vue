<template>
  <el-dialog
    v-model="dialogVisible"
    title="找不到订单编号？"
    :width="isMobile ? '95%' : '500px'"
    class="feedback-dialog"
    @update:model-value="(val: boolean) => { dialogVisible = val; }"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      :label-width="isMobile ? '80px' : '100px'"
    >
      <el-form-item label="客户订单编号" prop="customer_order_number">
        <el-input
          v-model="form.customer_order_number"
          placeholder="请输入您的订单编号"
          clearable
          @keyup.enter="handleSubmit"
        />
        <div class="form-tip">请输入您在系统中找不到的订单编号</div>
      </el-form-item>
      <el-form-item label="说明信息">
        <el-input
          v-model="form.message"
          type="textarea"
          :rows="4"
          placeholder="可选：请描述您的情况，帮助我们更快处理（例如：我在订单列表中搜索不到这个编号）"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="loading" @click="handleSubmit">
        提交反馈
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import { ElMessage, FormInstance, FormRules } from 'element-plus';
import { orderFeedbacksApi } from '../api/orderFeedbacks';

interface Props {
  modelValue: boolean;
  prefillOrderNumber?: string;
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
  (e: 'success'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const isMobile = computed(() => window.innerWidth <= 768);
const loading = ref(false);
const formRef = ref<FormInstance>();
const dialogVisible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
});

const form = reactive({
  customer_order_number: props.prefillOrderNumber || '',
  message: '',
});

// 监听 prefillOrderNumber 变化，更新表单
watch(() => props.prefillOrderNumber, (newVal: string | undefined) => {
  if (newVal) {
    form.customer_order_number = newVal;
  }
}, { immediate: true });

// 监听对话框打开，重置表单（如果提供了预填值）
watch(() => props.modelValue, (newVal: boolean) => {
  if (newVal && props.prefillOrderNumber) {
    form.customer_order_number = props.prefillOrderNumber;
  } else if (!newVal) {
    // 关闭时清空表单
    form.customer_order_number = '';
    form.message = '';
  }
});

const rules: FormRules = {
  customer_order_number: [
    { required: true, message: '请输入客户订单编号', trigger: 'blur' },
    { min: 1, max: 255, message: '订单编号长度应在1-255个字符之间', trigger: 'blur' },
  ],
};

const handleSubmit = async () => {
  if (!formRef.value) return;

  await formRef.value.validate(async (valid) => {
    if (!valid) return;

    loading.value = true;
    try {
      await orderFeedbacksApi.createFeedback({
        customer_order_number: form.customer_order_number.trim(),
        message: form.message.trim() || undefined,
      });
      ElMessage.success('反馈已提交，我们会尽快处理');
      dialogVisible.value = false;
      // 重置表单
      form.customer_order_number = '';
      form.message = '';
      emit('success');
    } catch (error: any) {
      ElMessage.error(error.response?.data?.error || '提交失败，请稍后重试');
    } finally {
      loading.value = false;
    }
  });
};
</script>

<style scoped>
.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
  line-height: 1.4;
}

@media (max-width: 768px) {
  .feedback-dialog :deep(.el-dialog) {
    margin: 5vh auto !important;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
  }

  .feedback-dialog :deep(.el-dialog__body) {
    flex: 1;
    overflow-y: auto;
    padding: 15px;
    -webkit-overflow-scrolling: touch;
  }
}
</style>

