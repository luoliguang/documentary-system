<template>
  <el-dialog
    v-model="visible"
    title="订单快速操作"
    :fullscreen="isMobile"
    :width="isMobile ? '94%' : '600px'"
    :top="isMobile ? '0' : '15vh'"
    class="quick-action-dialog"
    @close="handleClose"
  >
    <div v-loading="loading">
      <el-form
        v-if="order"
        :model="form"
        :label-width="isMobile ? 'auto' : '120px'"
        :label-position="isMobile ? 'top' : 'right'"
      >
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
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
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

const stripTimezoneInfo = (value: string) => {
  if (!value) return value;
  if (value.includes('T')) {
    const [datePart, timePartRaw] = value.split('T');
    const timePart = timePartRaw
      .replace('Z', '')
      .split('.')[0]
      .trim();
    return `${datePart} ${timePart || '00:00:00'}`;
  }
  return value;
};

// 规范化日期时间字符串
const normalizeDateTime = (date: string | null | undefined): string | null => {
  if (!date) return null;
  if (date.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
    return date;
  }
  if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return `${date} 00:00:00`;
  }
  const stripped = stripTimezoneInfo(date);
  if (stripped && stripped !== date) {
    return stripped;
  }
  return date;
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
    
    const normalizedEstimated =
      order.value.estimated_ship_date
        ? normalizeDateTime(order.value.estimated_ship_date)
        : null;
    order.value.estimated_ship_date = normalizedEstimated || undefined;

    // 初始化表单
    form.value.is_completed = order.value.is_completed || false;
    form.value.can_ship = order.value.can_ship || false;
    form.value.estimated_ship_date = normalizedEstimated;
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
    const normalizedOriginal =
      order.value.estimated_ship_date &&
      normalizeDateTime(order.value.estimated_ship_date);
    const normalizedNew = form.value.estimated_ship_date
      ? normalizeDateTime(form.value.estimated_ship_date)
      : null;

    if (normalizedNew !== normalizedOriginal) {
      updateData.estimated_ship_date = form.value.estimated_ship_date || undefined;
    }

    if (Object.keys(updateData).length > 0) {
      const response = await ordersApi.updateOrder(order.value.id, updateData);
      if (response.order?.estimated_ship_date) {
        const normalizedServer = normalizeDateTime(
          response.order.estimated_ship_date as string
        );
        order.value.estimated_ship_date = normalizedServer || undefined;
        form.value.estimated_ship_date = normalizedServer;
      } else if (!form.value.estimated_ship_date) {
        order.value.estimated_ship_date = undefined;
      }
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

const updateIsMobile = () => {
  isMobile.value = window.innerWidth <= 768;
};

onMounted(() => {
  updateIsMobile();
  window.addEventListener('resize', updateIsMobile);
});

onUnmounted(() => {
  window.removeEventListener('resize', updateIsMobile);
});
</script>

<style scoped>
.quick-action-dialog :deep(.el-dialog__body) {
  padding-top: 10px;
}

@media (max-width: 768px) {
  .quick-action-dialog :deep(.el-dialog__body) {
    height: calc(100vh - 120px);
    overflow-y: auto;
    padding-bottom: 24px;
  }
}
</style>

