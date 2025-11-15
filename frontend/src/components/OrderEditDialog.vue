<template>
  <el-dialog
    :model-value="modelValue"
    title="编辑订单"
    width="700px"
    @update:model-value="updateValue"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="120px"
    >
      <el-form-item label="订单状态" prop="status">
        <el-select v-model="form.status" placeholder="请选择状态" style="width: 100%">
          <el-option label="待处理" value="pending" />
          <el-option label="生产中" value="in_production" />
          <el-option label="已完成" value="completed" />
          <el-option label="已发货" value="shipped" />
          <el-option label="已取消" value="cancelled" />
        </el-select>
      </el-form-item>

      <el-form-item label="是否完成">
        <el-switch v-model="form.is_completed" />
      </el-form-item>

      <el-form-item label="是否可以出货">
        <el-switch v-model="form.can_ship" />
      </el-form-item>

      <el-form-item label="预计出货日期">
        <el-date-picker
          v-model="form.estimated_ship_date"
          type="date"
          placeholder="请选择预计出货日期"
          style="width: 100%"
          value-format="YYYY-MM-DD"
          clearable
        />
      </el-form-item>

      <el-form-item label="实际出货日期">
        <el-date-picker
          v-model="form.actual_ship_date"
          type="date"
          placeholder="请选择实际出货日期"
          style="width: 100%"
          value-format="YYYY-MM-DD"
          clearable
        />
      </el-form-item>

      <el-form-item label="情况备注">
        <el-input
          v-model="form.notes"
          type="textarea"
          :rows="4"
          placeholder="请输入情况备注"
        />
      </el-form-item>

      <el-form-item label="内部备注">
        <el-input
          v-model="form.internal_notes"
          type="textarea"
          :rows="4"
          placeholder="请输入内部备注（仅管理员可见）"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="updateValue(false)">取消</el-button>
      <el-button type="primary" :loading="loading" @click="handleSubmit">
        确定
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { useOrdersStore } from '../stores/orders';
import type { Order } from '../types';

interface Props {
  modelValue: boolean;
  order?: Order | null;
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
  (e: 'success'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const ordersStore = useOrdersStore();
const formRef = ref<FormInstance>();
const loading = ref(false);

const form = reactive({
  status: '',
  is_completed: false,
  can_ship: false,
  estimated_ship_date: '',
  actual_ship_date: '',
  notes: '',
  internal_notes: '',
});

const rules: FormRules = {
  status: [
    { required: true, message: '请选择订单状态', trigger: 'change' },
  ],
};

const updateValue = (value: boolean) => {
  emit('update:modelValue', value);
};

watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal && props.order) {
      form.status = props.order.status;
      form.is_completed = props.order.is_completed;
      form.can_ship = props.order.can_ship;
      form.estimated_ship_date = props.order.estimated_ship_date || '';
      form.actual_ship_date = props.order.actual_ship_date || '';
      form.notes = props.order.notes || '';
      form.internal_notes = props.order.internal_notes || '';
    }
  },
  { immediate: true }
);

const handleSubmit = async () => {
  if (!formRef.value || !props.order) return;

  await formRef.value.validate(async (valid) => {
    if (valid) {
      loading.value = true;
      try {
        await ordersStore.updateOrder(props.order!.id, form);
        ElMessage.success('订单更新成功');
        updateValue(false);
        emit('success');
      } catch (error) {
        ElMessage.error('更新失败');
      } finally {
        loading.value = false;
      }
    }
  });
};
</script>

