<template>
  <el-dialog
    v-model="visible"
    title="订单快速操作"
    :width="isMobile ? '90%' : '600px'"
    @close="handleClose"
  >
    <div v-loading="loading">
      <el-form :model="form" label-width="120px" v-if="order">
        <el-form-item label="订单编号">
          <el-input :value="order.order_number" readonly />
        </el-form-item>
        <el-form-item label="客户订单编号">
          <el-input :value="order.customer_order_number || '-'" readonly />
        </el-form-item>
        <el-form-item label="是否完成">
          <el-switch v-model="form.is_completed" />
        </el-form-item>
        <el-form-item label="可出货">
          <el-switch v-model="form.can_ship" />
        </el-form-item>
        <el-form-item label="预计出货日期">
          <el-date-picker
            v-model="form.estimated_ship_date"
            type="datetime"
            placeholder="选择日期时间"
            style="width: 100%"
            value-format="YYYY-MM-DD HH:mm:ss"
            format="YYYY-MM-DD HH:mm"
          />
        </el-form-item>
        <el-divider />
        <el-form-item label="跟进记录" required>
          <el-input
            v-model="form.follow_up_content"
            type="textarea"
            :rows="4"
            placeholder="请输入跟进情况（必填）"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
        <el-form-item>
          <el-checkbox v-model="form.is_visible_to_customer">
            对客户可见
          </el-checkbox>
          <div style="font-size: 12px; color: #909399; margin-top: 4px">
            勾选后，客户可以在订单详情中看到此跟进记录
          </div>
        </el-form-item>
      </el-form>
    </div>
    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" @click="submit" :loading="submitting">
        保存
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { ordersApi } from '../api/orders';
import { followUpsApi } from '../api/followUps';
import { useNotificationsStore } from '../stores/notifications';
import type { Order } from '../types';

const props = defineProps<{
  modelValue: boolean;
  orderId: number | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  success: [];
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const isMobile = ref(window.innerWidth <= 768);
const loading = ref(false);
const submitting = ref(false);
const order = ref<Order | null>(null);
const notificationsStore = useNotificationsStore();

const form = ref({
  is_completed: false,
  can_ship: false,
  estimated_ship_date: null as string | null,
  follow_up_content: '',
  is_visible_to_customer: true,
});

// 规范化日期时间字符串
const normalizeDateTime = (date: string | null | undefined): string | null => {
  if (!date) return null;
  if (date.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
    return date;
  }
  if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return `${date} 00:00:00`;
  }
  try {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) return date;
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const seconds = String(dateObj.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch (error) {
    return date;
  }
};

// 监听订单ID变化，加载订单信息
watch(
  () => props.orderId,
  async (newOrderId) => {
    if (newOrderId && visible.value) {
      await loadOrderData();
    }
  },
  { immediate: true }
);

// 监听对话框打开
watch(visible, async (newVal) => {
  if (newVal && props.orderId) {
    await loadOrderData();
  }
});

const loadOrderData = async () => {
  if (!props.orderId) return;

  loading.value = true;
  try {
    const response = await ordersApi.getOrderById(props.orderId);
    order.value = response.order;
    
    // 初始化表单
    form.value.is_completed = order.value.is_completed || false;
    form.value.can_ship = order.value.can_ship || false;
    form.value.estimated_ship_date = order.value.estimated_ship_date
      ? normalizeDateTime(order.value.estimated_ship_date)
      : null;
    form.value.follow_up_content = '';
    form.value.is_visible_to_customer = true;
  } catch (error) {
    ElMessage.error('加载订单信息失败');
  } finally {
    loading.value = false;
  }
};

const submit = async () => {
  if (!order.value) return;

  // 验证跟进记录
  if (!form.value.follow_up_content.trim()) {
    ElMessage.warning('请输入跟进记录');
    return;
  }

  submitting.value = true;
  try {
    // 更新订单信息
    const updateData: any = {};
    if (form.value.is_completed !== order.value.is_completed) {
      updateData.is_completed = form.value.is_completed;
    }
    if (form.value.can_ship !== order.value.can_ship) {
      updateData.can_ship = form.value.can_ship;
    }
    if (form.value.estimated_ship_date !== order.value.estimated_ship_date) {
      updateData.estimated_ship_date = form.value.estimated_ship_date || undefined;
    }

    if (Object.keys(updateData).length > 0) {
      await ordersApi.updateOrder(order.value.id, updateData);
    }

    // 创建跟进记录
    await followUpsApi.createFollowUp({
      order_id: order.value.id,
      content: form.value.follow_up_content.trim(),
      is_visible_to_customer: form.value.is_visible_to_customer,
    });

    // 标记该订单相关的所有通知为已读
    await notificationsStore.markOrderNotificationsAsRead(order.value.id);
    notificationsStore.fetchUnreadCount();

    ElMessage.success('操作成功');
    emit('success');
    handleClose();
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '操作失败');
  } finally {
    submitting.value = false;
  }
};

const handleClose = () => {
  visible.value = false;
};
</script>

<style scoped>
/* 样式可以根据需要添加 */
</style>

