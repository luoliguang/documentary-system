<template>
  <el-dialog
    v-model="visible"
    title="转交催单给其他生产跟单"
    :width="isMobile ? '90%' : '500px'"
    @close="handleClose"
  >
    <div v-loading="loading">
      <el-form :model="transferForm" label-width="120px" v-if="reminder">
        <el-form-item label="催单订单">
          <el-input :value="reminder.order_number || `订单 #${reminder.order_id}`" readonly />
        </el-form-item>
        <el-form-item label="转交给">
          <el-select
            v-model="transferForm.assigned_to"
            placeholder="请选择生产跟单"
            filterable
            clearable
            style="width: 100%"
          >
            <el-option
              v-for="pm in productionManagers"
              :key="pm.id"
              :label="pm.admin_notes || pm.username"
              :value="pm.id"
              :disabled="pm.id === authStore.user?.id"
            >
              <span>{{ pm.admin_notes || pm.username }}</span>
              <span
                v-if="orderType && pm.assigned_order_types && !pm.assigned_order_types.includes(orderType)"
                style="color: #f56c6c; margin-left: 10px"
              >
                (无权限处理此订单类型)
              </span>
            </el-option>
          </el-select>
          <div style="font-size: 12px; color: #909399; margin-top: 4px">
            提示：只能转交给有权限处理该订单类型的生产跟单
          </div>
        </el-form-item>
        <el-alert
          v-if="permissionRequestInfo"
          type="warning"
          :closable="false"
          class="permission-alert"
          show-icon
        >
          <p>
            目标生产跟单 <strong>{{ permissionRequestInfo.targetName }}</strong> 暂无权处理
            {{ permissionRequestInfo.orderType || '该订单' }}。
          </p>
          <p>您可以通知管理员/客服为其开通权限：</p>
          <el-input
            v-model="permissionRequestMessage"
            type="textarea"
            :rows="2"
            placeholder="补充说明（可选）"
            style="margin-bottom: 8px"
          />
          <div class="permission-actions">
            <el-button size="small" @click="resetPermissionState">不申请</el-button>
            <el-button
              size="small"
              type="primary"
              :loading="requestingPermission"
              @click="submitPermissionRequest"
            >
              通知管理员开权限
            </el-button>
          </div>
        </el-alert>
      </el-form>
    </div>
    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" @click="submitTransfer" :loading="submitting">
        确定转交
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { remindersApi } from '../api/reminders';
import { ordersApi } from '../api/orders';
import { useAuthStore } from '../stores/auth';
import type { DeliveryReminder } from '../types';
import type { OrderType } from '../constants/orderType';

const props = defineProps<{
  modelValue: boolean;
  reminderId: number | null;
  orderId: number | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  success: [];
}>();

const authStore = useAuthStore();

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const isMobile = ref(window.innerWidth <= 768);
const loading = ref(false);
const submitting = ref(false);
const reminder = ref<DeliveryReminder | null>(null);
const orderType = ref<OrderType | undefined>(undefined);
const productionManagers = ref<any[]>([]);
const permissionRequestInfo = ref<{
  targetId: number;
  targetName: string;
  orderType?: OrderType;
} | null>(null);
const permissionRequestMessage = ref('');
const requestingPermission = ref(false);

const transferForm = ref({
  assigned_to: undefined as number | undefined,
});

// 监听对话框打开
watch(visible, async (newVal) => {
  if (newVal) {
    await loadData();
  } else {
    transferForm.value.assigned_to = undefined;
    orderType.value = undefined;
    resetPermissionState();
  }
});

watch(
  () => transferForm.value.assigned_to,
  () => {
    resetPermissionState();
  }
);

const loadData = async () => {
  if (!props.reminderId || !props.orderId) return;

  loading.value = true;
  try {
    // 加载催单信息（如果需要）
    // 加载生产跟单列表
    if (productionManagers.value.length === 0) {
      const pmResponse = await ordersApi.getProductionManagers();
      productionManagers.value = pmResponse.productionManagers;
    }

    // 加载订单信息获取订单类型
    const orderResponse = await ordersApi.getOrderById(props.orderId);
    orderType.value = orderResponse.order.order_type;
    reminder.value = {
      id: props.reminderId,
      order_id: props.orderId,
      order_number: orderResponse.order.order_number,
      customer_order_number: orderResponse.order.customer_order_number,
    } as DeliveryReminder;
  } catch (error: any) {
    console.error('加载数据失败:', error);
    const errorMessage = error.response?.data?.error || error.message || '加载数据失败';
    ElMessage.error(errorMessage);
  } finally {
    loading.value = false;
  }
};

const submitTransfer = async () => {
  if (!transferForm.value.assigned_to) {
    ElMessage.warning('请选择要转交给的生产跟单');
    return;
  }

  if (!props.reminderId) {
    ElMessage.error('催单ID不存在');
    return;
  }

  // 验证目标生产跟单是否有权限
  if (orderType.value) {
    const targetPM = productionManagers.value.find(
      (pm) => pm.id === transferForm.value.assigned_to
    );
    if (
      targetPM &&
      targetPM.assigned_order_types &&
      !targetPM.assigned_order_types.includes(orderType.value)
    ) {
      ElMessage.error('目标生产跟单无权处理此订单类型');
      return;
    }
  }

  submitting.value = true;
  try {
    await remindersApi.transferReminder(props.reminderId, {
      assigned_to: transferForm.value.assigned_to!,
    });
    ElMessage.success('催单转交成功');
    emit('success');
    handleClose();
  } catch (error: any) {
    const errorCode = error.response?.data?.code;
    if (errorCode === 'TARGET_PM_NO_PERMISSION') {
      const selectedPmId = transferForm.value.assigned_to!;
      const targetPM =
        productionManagers.value.find((pm) => pm.id === selectedPmId) || {};
      permissionRequestInfo.value = {
        targetId: selectedPmId,
        targetName: targetPM.admin_notes || targetPM.username || '生产跟单',
        orderType: error.response?.data?.data?.order_type || orderType.value,
      };
      ElMessage.error(error.response?.data?.error || '目标生产跟单无权处理该订单');
    } else {
      ElMessage.error(error.response?.data?.error || '转交失败');
    }
  } finally {
    submitting.value = false;
  }
};

const handleClose = () => {
  visible.value = false;
};

const resetPermissionState = () => {
  permissionRequestInfo.value = null;
  permissionRequestMessage.value = '';
};

const submitPermissionRequest = async () => {
  if (!props.reminderId || !permissionRequestInfo.value) {
    return;
  }
  requestingPermission.value = true;
  try {
    await remindersApi.requestTransferPermission(props.reminderId, {
      target_pm_id: permissionRequestInfo.value.targetId,
      order_type: permissionRequestInfo.value.orderType,
      reason: permissionRequestMessage.value || undefined,
    });
    ElMessage.success('已通知管理员/客服，请等待处理');
    resetPermissionState();
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '申请权限失败');
  } finally {
    requestingPermission.value = false;
  }
};
</script>

<style scoped>
.permission-alert {
  margin-top: 12px;
}

.permission-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>

