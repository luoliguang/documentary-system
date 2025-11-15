<template>
  <div class="order-detail">
    <el-card v-loading="loading">
      <template #header>
        <div class="card-header">
          <h3>订单详情</h3>
          <div class="header-actions">
            <el-button @click="$router.back()">返回</el-button>
            <el-button
              v-if="authStore.isAdmin && !order?.is_completed"
              type="success"
              @click="handleComplete"
            >
              完成任务
            </el-button>
            <el-button
              v-if="authStore.isAdmin"
              type="primary"
              @click="editDialogVisible = true"
            >
              编辑订单
            </el-button>
          </div>
        </div>
      </template>

      <div v-if="order" class="detail-content">
        <!-- 基本信息 -->
        <el-descriptions title="基本信息" :column="2" border>
          <el-descriptions-item label="订单编号">
            {{ order.order_number }}
          </el-descriptions-item>
          <el-descriptions-item label="客户订单编号">
            <span v-if="order.customer_order_number">{{ order.customer_order_number }}</span>
            <el-button
              v-else-if="authStore.isCustomer"
              type="primary"
              size="small"
              link
              @click="showCustomerNumberDialog = true"
            >
              提交订单编号
            </el-button>
            <span v-else>-</span>
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="getStatusType(order.status)">
              {{ getStatusText(order.status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="是否完成">
            <el-tag :type="order.is_completed ? 'success' : 'info'">
              {{ order.is_completed ? '是' : '否' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="可出货">
            <el-tag :type="order.can_ship ? 'success' : 'info'">
              {{ order.can_ship ? '是' : '否' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="预计出货日期">
            {{ order.estimated_ship_date || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="实际出货日期">
            {{ order.actual_ship_date || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">
            {{ formatDate(order.created_at) }}
          </el-descriptions-item>
        </el-descriptions>

        <!-- 客户信息 -->
        <el-descriptions
          v-if="authStore.isAdmin"
          title="客户信息"
          :column="2"
          border
          style="margin-top: 20px"
        >
          <el-descriptions-item label="客户编号">
            {{ order.customer_code || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="公司名称">
            {{ order.company_name || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="联系人">
            {{ order.contact_name || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="联系电话">
            {{ order.customer_phone || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="邮箱">
            {{ order.customer_email || '-' }}
          </el-descriptions-item>
        </el-descriptions>

        <!-- 备注信息 -->
        <div style="margin-top: 20px">
          <h4>情况备注</h4>
          <el-input
            v-model="order.notes"
            type="textarea"
            :rows="4"
            placeholder="暂无备注"
            readonly
            style="margin-top: 10px"
          />
        </div>

        <!-- 内部备注（仅管理员可见） -->
        <div v-if="authStore.isAdmin && order.internal_notes" style="margin-top: 20px">
          <h4>内部备注</h4>
          <el-input
            v-model="order.internal_notes"
            type="textarea"
            :rows="4"
            placeholder="暂无内部备注"
            readonly
            style="margin-top: 10px"
          />
        </div>

        <!-- 订单状态历史 -->
        <div style="margin-top: 20px">
          <h4>状态历史</h4>
          <el-timeline v-if="history.length > 0" style="margin-top: 10px">
            <el-timeline-item
              v-for="item in history"
              :key="item.id"
              :timestamp="formatDate(item.created_at)"
              placement="top"
            >
              <p>
                <strong>{{ item.changed_by_username || '系统' }}</strong>
                {{ getStatusText(item.old_status || '') }}
                <el-icon><Right /></el-icon>
                {{ getStatusText(item.new_status || '') }}
              </p>
              <p v-if="item.notes" style="color: #909399; font-size: 12px">
                {{ item.notes }}
              </p>
            </el-timeline-item>
          </el-timeline>
          <el-empty v-else description="暂无状态历史" />
        </div>
      </div>
    </el-card>

    <!-- 编辑订单对话框 -->
    <OrderEditDialog
      v-model="editDialogVisible"
      :order="order"
      @success="loadOrder"
    />

    <!-- 提交客户订单编号对话框 -->
    <el-dialog
      v-model="showCustomerNumberDialog"
      title="提交客户订单编号"
      width="500px"
    >
      <el-form :model="customerNumberForm" label-width="120px">
        <el-form-item label="客户订单编号" required>
          <el-input
            v-model="customerNumberForm.customer_order_number"
            placeholder="请输入客户订单编号"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCustomerNumberDialog = false">取消</el-button>
        <el-button type="primary" @click="submitCustomerNumber">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Right } from '@element-plus/icons-vue';
import { useAuthStore } from '../../stores/auth';
import { useOrdersStore } from '../../stores/orders';
import { ordersApi } from '../../api/orders';
import OrderEditDialog from '../../components/OrderEditDialog.vue';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const ordersStore = useOrdersStore();

const loading = ref(false);
const editDialogVisible = ref(false);
const showCustomerNumberDialog = ref(false);
const history = ref<any[]>([]);

const customerNumberForm = ref({
  customer_order_number: '',
});

const order = computed(() => ordersStore.currentOrder);

const getStatusType = (status: string) => {
  const map: Record<string, string> = {
    pending: 'info',
    in_production: 'warning',
    completed: 'success',
    shipped: 'success',
    cancelled: 'danger',
  };
  return map[status] || 'info';
};

const getStatusText = (status: string) => {
  const map: Record<string, string> = {
    pending: '待处理',
    in_production: '生产中',
    completed: '已完成',
    shipped: '已发货',
    cancelled: '已取消',
  };
  return map[status] || status || '-';
};

const formatDate = (date: string) => {
  if (!date) return '-';
  return new Date(date).toLocaleString('zh-CN');
};

const loadOrder = async () => {
  const id = Number(route.params.id);
  if (!id) return;

  loading.value = true;
  try {
    await ordersStore.fetchOrderById(id);
    const historyResponse = await ordersApi.getOrderStatusHistory(id);
    history.value = historyResponse.history;
  } catch (error) {
    ElMessage.error('加载订单详情失败');
    router.push('/');
  } finally {
    loading.value = false;
  }
};

const handleComplete = async () => {
  if (!order.value) return;

  try {
    await ElMessageBox.prompt('请输入完成备注（可选）', '完成任务', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputPlaceholder: '备注信息',
    });
    await ordersStore.completeOrder(order.value.id);
    ElMessage.success('订单已标记为完成');
    await loadOrder();
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('操作失败');
    }
  }
};

const submitCustomerNumber = async () => {
  if (!order.value || !customerNumberForm.value.customer_order_number) {
    ElMessage.warning('请输入客户订单编号');
    return;
  }

  try {
    await ordersApi.updateCustomerOrderNumber(
      order.value.id,
      customerNumberForm.value.customer_order_number
    );
    ElMessage.success('客户订单编号提交成功');
    showCustomerNumberDialog.value = false;
    customerNumberForm.value.customer_order_number = '';
    await loadOrder();
  } catch (error) {
    ElMessage.error('提交失败');
  }
};

onMounted(() => {
  loadOrder();
});
</script>

<style scoped>
.order-detail {
  width: 100%;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-content {
  padding: 10px 0;
}

h4 {
  margin: 0 0 10px 0;
  font-size: 16px;
  font-weight: 500;
  color: #303133;
}
</style>

