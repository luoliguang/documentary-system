<template>
  <el-dialog
    v-model="visible"
    title="分配订单给生产跟单"
    :width="isMobile ? '90%' : '500px'"
    @close="handleClose"
  >
    <div v-loading="loading">
      <el-form :model="assignForm" label-width="120px" v-if="order">
        <el-form-item label="订单编号">
          <el-input :value="order.order_number" readonly />
        </el-form-item>
        <el-form-item label="订单类型">
          <el-select
            v-model="assignForm.order_type"
            placeholder="请选择订单类型"
            style="width: 100%"
            @change="handleOrderTypeChange"
          >
            <el-option
              v-for="type in orderTypes"
              :key="type.value"
              :label="type.label"
              :value="type.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="分配给">
          <el-select
            v-model="assignForm.assigned_to_ids"
            placeholder="请选择生产跟单（可多选，留空表示取消分配）"
            multiple
            collapse-tags
            collapse-tags-tooltip
            filterable
            clearable
            style="width: 100%"
            @change="handleAssignedChange"
          >
            <el-option
              v-for="pm in productionManagers"
              :key="pm.id"
              :label="pm.admin_notes || pm.username"
              :value="pm.id"
              :disabled="
                assignForm.order_type &&
                pm.assigned_order_types &&
                !pm.assigned_order_types.includes(assignForm.order_type)
              "
            >
              <span>{{ pm.admin_notes || pm.username }}</span>
              <span
                v-if="
                  assignForm.order_type &&
                  pm.assigned_order_types &&
                  !pm.assigned_order_types.includes(assignForm.order_type)
                "
                style="color: #f56c6c; margin-left: 10px"
              >
                (无权限处理此订单类型)
              </span>
            </el-option>
          </el-select>
          <div style="font-size: 12px; color: #909399; margin-top: 4px">
            提示：只能分配给有权限处理该订单类型的生产跟单；可多选实现协同处理
          </div>
        </el-form-item>
        <el-form-item
          v-if="assignForm.assigned_to_ids.length > 1"
          label="主负责人"
        >
          <el-select
            v-model="assignForm.primary_assigned_to"
            placeholder="请选择主负责人"
            style="width: 100%"
          >
            <el-option
              v-for="pmId in assignForm.assigned_to_ids"
              :key="pmId"
              :label="getProductionManagerName(pmId)"
              :value="pmId"
            />
          </el-select>
          <div style="font-size: 12px; color: #909399; margin-top: 4px">
            主负责人用于在列表中展示及兼容旧版接口
          </div>
        </el-form-item>
      </el-form>
    </div>
    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" @click="submitAssign" :loading="submitting">
        确定
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { ordersApi } from '../api/orders';
import { useConfigOptions } from '../composables/useConfigOptions';
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
const productionManagers = ref<any[]>([]);
const { orderTypes, loadOrderTypes } = useConfigOptions();

const assignForm = ref({
  assigned_to_ids: [] as number[],
  primary_assigned_to: undefined as number | undefined,
  order_type: 'required' as 'required' | 'scattered' | 'photo',
});

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
    // 加载订单信息
    const orderResponse = await ordersApi.getOrderById(props.orderId);
    order.value = orderResponse.order;
    assignForm.value.assigned_to_ids =
      order.value.assigned_to_ids?.slice() ||
      (order.value.assigned_to ? [order.value.assigned_to] : []);
    assignForm.value.primary_assigned_to =
      order.value.assigned_to_ids?.[0] ||
      order.value.assigned_to ||
      undefined;
    assignForm.value.order_type = (order.value.order_type || 'required') as 'required' | 'scattered' | 'photo';

    // 加载订单类型
    await loadOrderTypes();

    // 每次加载都刷新生产跟单权限，确保实时
    const pmResponse = await ordersApi.getProductionManagers({ force: true });
    productionManagers.value = pmResponse.productionManagers;
  } catch (error) {
    ElMessage.error('加载订单信息失败');
  } finally {
    loading.value = false;
  }
};

const handleOrderTypeChange = () => {
  // 当订单类型改变时，清空已选择的生产跟单（如果该生产跟单没有权限）
  if (assignForm.value.assigned_to_ids.length) {
    const selectedPM = productionManagers.value.find(
      (pm) => pm.id === assignForm.value.primary_assigned_to
    );
    if (
      selectedPM &&
      selectedPM.assigned_order_types &&
      !selectedPM.assigned_order_types.includes(assignForm.value.order_type)
    ) {
      assignForm.value.assigned_to_ids = assignForm.value.assigned_to_ids.filter(
        (id) => id !== selectedPM.id
      );
      assignForm.value.primary_assigned_to = assignForm.value.assigned_to_ids[0];
      ElMessage.warning('当前选择的主负责人没有权限处理此订单类型，已自动移除');
    }

    // 同时确保所有协同人员都在权限范围内
    const filtered = assignForm.value.assigned_to_ids.filter((id) => {
      const pm = productionManagers.value.find((manager) => manager.id === id);
      if (
        pm &&
        pm.assigned_order_types &&
        assignForm.value.order_type &&
        !pm.assigned_order_types.includes(assignForm.value.order_type)
      ) {
        return false;
      }
      return true;
    });
    if (filtered.length !== assignForm.value.assigned_to_ids.length) {
      assignForm.value.assigned_to_ids = filtered;
      ElMessage.warning('已移除无权限的生产跟单');
    }
    handleAssignedChange();
  }
};

const handleAssignedChange = () => {
  if (!assignForm.value.assigned_to_ids.length) {
    assignForm.value.primary_assigned_to = undefined;
    return;
  }
  if (
    !assignForm.value.primary_assigned_to ||
    !assignForm.value.assigned_to_ids.includes(assignForm.value.primary_assigned_to)
  ) {
    assignForm.value.primary_assigned_to = assignForm.value.assigned_to_ids[0];
  }
};

const getProductionManagerName = (id: number) => {
  const pm = productionManagers.value.find((item) => item.id === id);
  return pm?.admin_notes || pm?.username || `ID ${id}`;
};

const submitAssign = async () => {
  if (!order.value) return;

  submitting.value = true;
  try {
    // 如果订单类型改变了，先更新订单类型
    if (assignForm.value.order_type !== order.value.order_type) {
      await ordersApi.updateOrder(order.value.id, {
        order_type: assignForm.value.order_type,
      });
    }

    // 然后分配订单
    await ordersApi.assignOrder(order.value.id, {
      assigned_to_ids: assignForm.value.assigned_to_ids,
      primary_assigned_to: assignForm.value.primary_assigned_to ?? null,
    });
    ElMessage.success('订单分配成功');
    emit('success');
    handleClose();
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '分配失败');
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

