<template>
  <div class="order-create">
    <el-card>
      <template #header>
        <h3>创建订单</h3>
      </template>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="120px"
        style="max-width: 800px"
      >
        <el-form-item label="订单编号" prop="order_number">
          <el-input
            v-model="form.order_number"
            placeholder="请输入订单编号"
            clearable
          />
        </el-form-item>

        <el-form-item label="客户" prop="customer_id">
          <el-select
            v-model="form.customer_id"
            placeholder="请选择客户"
            filterable
            style="width: 100%"
            @change="handleCustomerChange"
          >
            <el-option
              v-for="customer in customers"
              :key="customer.id"
              :label="`${customer.company_name || customer.username} (${customer.customer_code})`"
              :value="customer.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="客户订单编号">
          <el-input
            v-model="form.customer_order_number"
            placeholder="请输入客户订单编号（可选）"
            clearable
          />
        </el-form-item>

        <el-form-item label="订单状态" prop="status">
          <el-select v-model="form.status" placeholder="请选择状态">
            <el-option label="待处理" value="pending" />
            <el-option label="生产中" value="in_production" />
            <el-option label="已完成" value="completed" />
            <el-option label="已发货" value="shipped" />
            <el-option label="已取消" value="cancelled" />
          </el-select>
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

        <el-form-item>
          <el-button type="primary" :loading="loading" @click="handleSubmit">
            创建订单
          </el-button>
          <el-button @click="$router.back()">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { ordersApi } from '../../api/orders';

const router = useRouter();
const formRef = ref<FormInstance>();
const loading = ref(false);
const customers = ref<any[]>([]);

const form = reactive({
  order_number: '',
  customer_id: undefined as number | undefined,
  customer_code: '',
  customer_order_number: '',
  status: 'pending',
  can_ship: false,
  estimated_ship_date: '',
  notes: '',
  internal_notes: '',
});

const rules: FormRules = {
  order_number: [
    { required: true, message: '请输入订单编号', trigger: 'blur' },
  ],
  customer_id: [
    { required: true, message: '请选择客户', trigger: 'change' },
  ],
  status: [
    { required: true, message: '请选择订单状态', trigger: 'change' },
  ],
};

const loadCustomers = async () => {
  try {
    const response = await ordersApi.getCustomers();
    customers.value = response.customers;
  } catch (error) {
    ElMessage.error('加载客户列表失败');
  }
};

const handleCustomerChange = (customerId: number) => {
  const customer = customers.value.find((c) => c.id === customerId);
  if (customer) {
    form.customer_code = customer.customer_code;
  }
};

const handleSubmit = async () => {
  if (!formRef.value) return;

  await formRef.value.validate(async (valid) => {
    if (valid) {
      loading.value = true;
      try {
        await ordersApi.createOrder(form);
        ElMessage.success('订单创建成功');
        router.push('/');
      } catch (error: any) {
        ElMessage.error(error.response?.data?.error || '创建订单失败');
      } finally {
        loading.value = false;
      }
    }
  });
};

onMounted(() => {
  loadCustomers();
});
</script>

<style scoped>
.order-create {
  width: 100%;
}
</style>

