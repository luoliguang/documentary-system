<template>
  <el-dialog
    :model-value="modelValue"
    title="编辑订单"
    :width="dialogWidth"
    class="order-edit-dialog"
    @update:model-value="updateValue"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      :label-width="labelWidth"
      class="order-edit-form"
    >
      <el-form-item
        v-if="authStore.canManageOrders || isCustomerReadOnly"
        label="工厂订单编号"
        prop="order_number"
      >
        <el-input
          v-model="form.order_number"
          placeholder="请输入工厂订单编号"
          clearable
          style="width: 100%"
          :disabled="isFieldDisabled('order_number')"
        />
      </el-form-item>

      <el-form-item
        v-if="authStore.canManageOrders || isCustomerReadOnly"
        label="客户订单编号"
        prop="customer_order_number"
      >
        <el-input
          v-model="form.customer_order_number"
          placeholder="请输入客户订单编号"
          clearable
          style="width: 100%"
          :disabled="isFieldDisabled('customer_order_number')"
        />
      </el-form-item>

      <el-form-item v-if="authStore.canManageOrders" label="客户公司" prop="company_id">
        <el-select
          v-model="form.company_id"
          placeholder="请选择客户公司（可搜索公司名）"
          filterable
          style="width: 100%"
          @change="handleCompanyChange"
          @search="handleCompanySearch"
        >
          <el-option
            v-for="company in companies"
            :key="company.id"
            :label="`${company.company_name}${company.company_code ? ' (' + company.company_code + ')' : ''} (${company.user_count || 0}个账号, ${company.order_count || 0}个订单)`"
            :value="company.id"
          />
        </el-select>
        <div style="font-size: 12px; color: #909399; margin-top: 4px">
          提示：切换客户公司后，请选择具体客户账号，系统会自动关联客户编号
        </div>
      </el-form-item>
      <el-form-item v-else-if="canViewCompanyReadonly" label="客户公司">
        <el-input
          :model-value="props.order?.company_name || '未设置'"
          disabled
          placeholder="客户公司"
        />
      </el-form-item>

      <el-form-item
        v-if="authStore.canManageOrders && form.company_id && companyCustomers.length > 0"
        label="关联客户账号"
        prop="customer_id"
      >
        <el-select
          v-model="form.customer_id"
          placeholder="请选择客户账号"
          filterable
          style="width: 100%"
          @change="handleCustomerChange"
        >
          <el-option
            v-for="customer in companyCustomers"
            :key="customer.id"
            :label="`${customer.username}${customer.customer_code ? ' (' + customer.customer_code + ')' : ''}`"
            :value="customer.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item
        v-else-if="authStore.canManageOrders && form.company_id && companyCustomers.length === 0"
        label="关联客户账号"
      >
        <el-alert
          type="warning"
          :closable="false"
          show-icon
        >
          <template #title>
            <span>该公司暂无客户账号，请先创建客户账号</span>
          </template>
        </el-alert>
      </el-form-item>

      <el-form-item
        v-if="authStore.canManageOrders || isCustomerReadOnly"
        label="订单类型"
        prop="order_type"
      >
        <el-select
          v-model="form.order_type"
          placeholder="请选择订单类型"
          style="width: 100%"
          :disabled="isFieldDisabled('order_type')"
        >
          <el-option
            v-for="type in orderTypes"
            :key="type.value"
            :label="type.label"
            :value="type.value"
          />
        </el-select>
      </el-form-item>

      <el-form-item
        v-if="authStore.canManageOrders || isCustomerReadOnly"
        label="订单状态"
        prop="status"
      >
        <el-select
          v-model="form.status"
          placeholder="请选择状态"
          style="width: 100%"
          :disabled="isFieldDisabled('status')"
        >
          <el-option
            v-for="status in orderStatuses"
            :key="status.value"
            :label="status.label"
            :value="status.value"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="是否完成">
        <el-switch v-model="form.is_completed" :disabled="isFieldDisabled('is_completed')" />
      </el-form-item>

      <el-form-item label="是否可以出货">
        <el-switch v-model="form.can_ship" :disabled="isFieldDisabled('can_ship')" />
      </el-form-item>

      <el-form-item
        v-if="authStore.canManageOrders || isCustomerReadOnly"
        label="下单时间"
      >
        <el-date-picker
          v-model="form.order_date"
          type="datetime"
          placeholder="请选择下单时间"
          style="width: 100%"
          value-format="YYYY-MM-DD HH:mm:ss"
          format="YYYY-MM-DD HH:mm"
          :disabled-date="disabledFutureDate"
          clearable
          popper-class="mobile-datetime-picker-popper"
          :disabled="isFieldDisabled('order_date')"
        />
      </el-form-item>

      <el-form-item label="预计出货日期">
        <el-date-picker
          v-model="form.estimated_ship_date"
          type="datetime"
          placeholder="请选择预计出货日期时间"
          style="width: 100%"
          value-format="YYYY-MM-DD HH:mm:ss"
          format="YYYY-MM-DD HH:mm"
          clearable
          popper-class="mobile-datetime-picker-popper"
          :disabled="isFieldDisabled('estimated_ship_date')"
        />
      </el-form-item>

      <el-form-item
        v-if="authStore.canManageOrders || isCustomerReadOnly"
        label="实际出货日期"
      >
        <el-date-picker
          v-model="form.actual_ship_date"
          type="date"
          placeholder="请选择实际出货日期"
          style="width: 100%"
          value-format="YYYY-MM-DD"
          format="YYYY-MM-DD"
          clearable
          :disabled="isFieldDisabled('actual_ship_date')"
        />
      </el-form-item>

      <el-form-item label="情况备注">
        <el-input
          v-model="form.notes"
          type="textarea"
          :rows="4"
          placeholder="请输入情况备注"
          :disabled="isFieldDisabled('notes')"
        />
      </el-form-item>

      <el-form-item v-if="authStore.canManageOrders" label="内部备注">
        <el-input
          v-model="form.internal_notes"
          type="textarea"
          :rows="4"
          placeholder="请输入内部备注（仅管理员可见）"
        />
      </el-form-item>

      <el-form-item v-if="authStore.canManageOrders" label="订单图片">
        <!-- 粘贴提示区域 - 仅在桌面端显示 -->
        <div v-if="!isMobile" class="paste-hint-box">
          <div class="paste-hint-content">
            <el-icon class="paste-icon"><DocumentCopy /></el-icon>
            <div class="paste-hint-text">
              <strong>快速粘贴图片：</strong>
              <span>复制图片后，在此对话框按 <kbd>Ctrl+V</kbd> 或 <kbd>Cmd+V</kbd> 即可上传</span>
            </div>
          </div>
        </div>
        
        <div 
          ref="uploadAreaRef"
          style="width: 100%"
          class="image-upload-area"
          :tabindex="isMobile ? -1 : 0"
          @paste="handlePasteIfNotMobile"
          @dragover.prevent="handleDragOverIfNotMobile"
          @drop.prevent="handleDropIfNotMobile"
          @focus="handleFocusIfNotMobile"
          @blur="handleBlurIfNotMobile"
        >
          <div v-if="form.images && form.images.length > 0" class="image-list">
            <div v-for="(image, index) in form.images" :key="index" class="image-item">
              <el-image :src="image" fit="cover" class="preview-image" loading="lazy" />
              <el-button
                type="danger"
                size="small"
                circle
                class="remove-image-btn"
                @click="removeImage(index)"
              >
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
          </div>
          <div class="upload-options">
            <el-upload
              :action="uploadAction"
              :headers="uploadHeaders"
              :on-success="handleImageSuccess"
              :before-upload="beforeImageUpload"
              :show-file-list="false"
              accept="image/*"
              list-type="picture"
              name="file"
            >
              <el-button type="primary">
                <el-icon><Upload /></el-icon>
                点击上传图片
              </el-button>
            </el-upload>
            <div class="upload-tips">
              <div class="tip-item">
                <el-icon><Picture /></el-icon>
                <span>支持 JPG、PNG 格式，单张图片不超过 5MB</span>
              </div>
              <div v-if="!isMobile" class="tip-item">
                <el-icon><UploadFilled /></el-icon>
                <span>或直接拖拽图片文件到此处</span>
              </div>
            </div>
          </div>
        </div>
      </el-form-item>

      <el-form-item v-if="authStore.canManageOrders" label="发货单号">
        <div style="width: 100%">
          <div v-if="form.shipping_tracking_numbers && form.shipping_tracking_numbers.length > 0" class="tracking-list">
            <div
              v-for="(tracking, index) in form.shipping_tracking_numbers"
              :key="index"
              class="tracking-item"
            >
              <el-select v-model="tracking.type" style="width: 150px" placeholder="单号类型">
                <el-option label="主单号" value="main" />
                <el-option label="补件单号" value="supplement" />
                <el-option label="分地址单号" value="split_address" />
                <el-option label="其他" value="other" />
              </el-select>
              <el-input
                v-model="tracking.label"
                placeholder="自定义标签（可选）"
                style="width: 150px; margin: 0 10px"
              />
              <el-input
                v-model="tracking.number"
                placeholder="请输入单号"
                style="flex: 1"
              />
              <el-button
                type="danger"
                size="small"
                @click="removeTrackingNumber(index)"
              >
                删除
              </el-button>
            </div>
          </div>
          <el-button type="primary" @click="addTrackingNumber">添加单号</el-button>
        </div>
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
import { ref, reactive, watch, computed, onMounted, onUnmounted } from 'vue';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { Delete, Upload, Picture, DocumentCopy, UploadFilled } from '@element-plus/icons-vue';
import { useOrdersStore } from '../stores/orders';
import { useAuthStore } from '../stores/auth';
import { useConfigOptions } from '../composables/useConfigOptions';
import { ordersApi } from '../api/orders';
import { useCustomerCompaniesStore } from '../stores/customerCompanies';
import type { Order, CustomerCompany, User } from '../types';

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
const authStore = useAuthStore();
const formRef = ref<FormInstance>();
const loading = ref(false);
const uploadAreaRef = ref<HTMLElement | null>(null);
const isUploadAreaFocused = ref(false);

// 响应式布局
const dialogWidth = ref('700px');
const labelWidth = ref('120px');
const isMobile = ref(false);

const updateLayout = () => {
  const width = window.innerWidth;
  isMobile.value = width <= 768;
  if (width <= 480) {
    dialogWidth.value = '95%';
    labelWidth.value = '80px';
  } else if (width <= 768) {
    dialogWidth.value = '95%';
    labelWidth.value = '100px';
  } else if (width <= 1024) {
    dialogWidth.value = '85%';
    labelWidth.value = '120px';
  } else {
    dialogWidth.value = '700px';
    labelWidth.value = '120px';
  }
};

// 配置选项
const { orderTypes, orderStatuses, loadOrderTypes, loadOrderStatuses } = useConfigOptions();

// 客户公司与账号
const customerCompaniesStore = useCustomerCompaniesStore();
const manualCompanyOptions = ref<CustomerCompany[] | null>(null);
const companies = computed(() => manualCompanyOptions.value ?? customerCompaniesStore.companies);
const companyCustomers = ref<User[]>([]);
const canManageCompanies = computed(() => authStore.canManageOrders);
const isProductionManagerOnly = computed(
  () => authStore.isProductionManager && !authStore.canManageOrders
);
const isCustomerReadOnly = computed(
  () => authStore.isCustomer && !authStore.canManageOrders
);
const canViewCompanyReadonly = computed(
  () => isProductionManagerOnly.value || isCustomerReadOnly.value
);
const isFieldDisabled = (field: string) => {
  if (!isCustomerReadOnly.value) {
    return false;
  }
  return field !== 'customer_order_number';
};

const form = reactive<Partial<Order> & {
  order_number?: string;
  customer_order_number?: string;
  company_id?: number;
  customer_id?: number;
  customer_code?: string;
  order_date?: string;
  images: string[];
  shipping_tracking_numbers: Array<{ type: string; number: string; label?: string }>;
}>({
  order_number: '',
  customer_order_number: '',
  company_id: undefined,
  customer_id: undefined,
  customer_code: '',
  status: 'pending' as Order['status'],
  is_completed: false,
  can_ship: false,
  order_date: '',
  estimated_ship_date: '',
  actual_ship_date: '',
  notes: '',
  internal_notes: '',
  images: [],
  shipping_tracking_numbers: [],
});

const uploadAction = computed(() => {
  // 这里可以配置图片上传接口，暂时使用占位符
  return '/api/upload/image';
});

const uploadHeaders = computed(() => {
  const token = authStore.token;
  return token ? { Authorization: `Bearer ${token}` } : {};
});

const rules: FormRules = {
  company_id: [
    { required: true, message: '请选择客户公司', trigger: 'change' },
  ],
  customer_id: [
    { required: true, message: '请选择客户账号', trigger: 'change' },
  ],
  status: [
    { required: true, message: '请选择订单状态', trigger: 'change' },
  ],
};

// 禁用未来日期
const disabledFutureDate = (time: Date) => {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return time.getTime() > today.getTime();
};

const updateValue = (value: boolean) => {
  emit('update:modelValue', value);
};

// 将日期转换为日期时间选择器需要的格式
const formatDateTimeForPicker = (date: string | null | undefined): string => {
  if (!date) return '';
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

const formatDateForPicker = (date: string | null | undefined): string => {
  if (!date) return '';
  try {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      // 如果后端已经是 YYYY-MM-DD，直接返回
      const [onlyDate] = date.split(' ');
      return onlyDate || '';
    }
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (error) {
    const [onlyDate] = (date as string).split(' ');
    return onlyDate || '';
  }
};

const loadCompanies = async (search?: string) => {
  if (!canManageCompanies.value) {
    return;
  }
  try {
    const result = await customerCompaniesStore.fetchCompanies({
      search,
      force: !!search,
    });
    if (search) {
      manualCompanyOptions.value = result;
    } else {
      manualCompanyOptions.value = null;
    }
  } catch (error) {
    console.error('加载客户公司失败:', error);
    ElMessage.error('加载客户公司失败');
  }
};

const handleCompanySearch = (search: string) => {
  if (search) {
    loadCompanies(search);
  } else {
    loadCompanies();
  }
};

const handleCustomerChange = (customerId?: number) => {
  if (!customerId) {
    form.customer_code = '';
    return;
  }
  const customer = companyCustomers.value.find((c) => c.id === customerId);
  if (customer) {
    form.customer_code = customer.customer_code || '';
  }
};

const loadCompanyCustomers = async (companyId?: number, preserveSelection = true) => {
  if (!canManageCompanies.value) {
    return;
  }
  if (!companyId) {
    companyCustomers.value = [];
    if (!preserveSelection) {
      form.customer_id = undefined;
      form.customer_code = '';
    }
    return;
  }
  try {
    const response = await ordersApi.getCustomers({ company_id: companyId });
    companyCustomers.value = response.customers;

    if (companyCustomers.value.length === 0) {
      form.customer_id = undefined;
      form.customer_code = '';
      return;
    }

    const existingCustomer = companyCustomers.value.some(
      (customer) => customer.id === form.customer_id
    );

    if (!preserveSelection || !existingCustomer) {
      form.customer_id = companyCustomers.value[0].id;
    }

    handleCustomerChange(form.customer_id);
  } catch (error) {
    console.error('加载客户账号失败:', error);
    ElMessage.error('加载客户账号失败');
  }
};

const handleCompanyChange = async (companyId?: number) => {
  await loadCompanyCustomers(companyId, false);
};

watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal && props.order && props.order.id) {
      form.order_number = props.order.order_number || '';
      form.customer_order_number = props.order.customer_order_number || '';
      form.company_id = props.order.company_id;
      form.customer_id = props.order.customer_id;
      form.customer_code = props.order.customer_code || '';
      form.status = props.order.status;
      form.is_completed = props.order.is_completed;
      form.can_ship = props.order.can_ship;
      form.order_date = props.order.order_date || '';
      form.estimated_ship_date = formatDateTimeForPicker(props.order.estimated_ship_date);
      form.actual_ship_date = formatDateForPicker(props.order.actual_ship_date);
      form.notes = props.order.notes || '';
      form.internal_notes = props.order.internal_notes || '';
      form.images = props.order.images ? [...props.order.images] : [];
      form.shipping_tracking_numbers = props.order.shipping_tracking_numbers
        ? props.order.shipping_tracking_numbers.map((tracking) => ({ ...tracking }))
        : [];
      if (props.order.company_id && canManageCompanies.value) {
        loadCompanyCustomers(props.order.company_id, true);
      } else {
        companyCustomers.value = [];
      }
    }
  },
  { immediate: true }
);

const beforeImageUpload = (file: File) => {
  const isImage = file.type.startsWith('image/');
  const isLt5M = file.size / 1024 / 1024 < 5;

  if (!isImage) {
    ElMessage.error('只能上传图片文件！');
    return false;
  }
  if (!isLt5M) {
    ElMessage.error('图片大小不能超过 5MB！');
    return false;
  }
  return true;
};

const handleImageSuccess = (response: any, file: File) => {
  // 这里需要根据实际的上传接口返回格式调整
  // 假设返回格式为 { url: '...' }
  const imageUrl = response.url || response.data?.url || URL.createObjectURL(file);
  if (form.images) {
    form.images.push(imageUrl);
  }
  ElMessage.success('图片上传成功');
};

const removeImage = (index: number) => {
  if (form.images) {
    form.images.splice(index, 1);
  }
};

const handleFocus = () => {
  isUploadAreaFocused.value = true;
};

const handleBlur = () => {
  isUploadAreaFocused.value = false;
};

// 移动端禁用粘贴和拖拽事件
const handlePasteIfNotMobile = (e: ClipboardEvent) => {
  if (!isMobile.value) {
    handlePaste(e);
  }
};

const handleDragOverIfNotMobile = (e: DragEvent) => {
  if (!isMobile.value) {
    e.preventDefault();
  }
};

const handleDropIfNotMobile = (e: DragEvent) => {
  if (!isMobile.value) {
    handleDrop(e);
  }
};

const handleFocusIfNotMobile = () => {
  if (!isMobile.value) {
    handleFocus();
  }
};

const handleBlurIfNotMobile = () => {
  if (!isMobile.value) {
    handleBlur();
  }
};

const handlePaste = async (event: ClipboardEvent) => {
  // 如果焦点在输入框或文本域，不处理粘贴（让浏览器正常处理文本粘贴）
  const activeElement = document.activeElement;
  if (activeElement) {
    const tagName = activeElement.tagName;
    const inputType = (activeElement as HTMLInputElement).type;
    
    // 如果是普通输入框或文本域，且不是文件输入框，不处理
    if ((tagName === 'INPUT' && inputType !== 'file') || tagName === 'TEXTAREA') {
      return;
    }
  }

  const clipboardData = event.clipboardData;
  if (!clipboardData) return;

  const items = clipboardData.items;
  if (!items || items.length === 0) return;

  // 查找图片数据
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    // 检查是否是图片文件
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      event.preventDefault();
      event.stopPropagation();
      
      const file = item.getAsFile();
      if (file) {
        // 验证文件
        if (!beforeImageUpload(file)) {
          return;
        }
        // 上传文件
        await uploadImageFile(file);
      }
      return; // 处理完就返回
    }
  }
};

const handleDrop = async (event: DragEvent) => {
  const files = event.dataTransfer?.files;
  if (!files) return;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.type.startsWith('image/')) {
      // 验证文件
      if (!beforeImageUpload(file)) {
        continue;
      }
      // 上传文件
      await uploadImageFile(file);
    }
  }
};

const uploadImageFile = async (file: File) => {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const headers: HeadersInit = {};
    const token = authStore.token;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(uploadAction.value, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      throw new Error('上传失败');
    }

    const result = await response.json();
    const imageUrl = result.url || result.data?.url;
    
    if (imageUrl) {
      if (!form.images) {
        form.images = [];
      }
      form.images.push(imageUrl);
      ElMessage.success('图片粘贴/拖拽上传成功');
    } else {
      throw new Error('未获取到图片URL');
    }
  } catch (error: any) {
    ElMessage.error(error.message || '图片上传失败');
  }
};

const addTrackingNumber = () => {
  if (form.shipping_tracking_numbers) {
    form.shipping_tracking_numbers.push({
      type: 'main',
      number: '',
      label: '',
    });
  }
};

const removeTrackingNumber = (index: number) => {
  if (form.shipping_tracking_numbers) {
    form.shipping_tracking_numbers.splice(index, 1);
  }
};

const buildUpdatePayload = (): Partial<Order> => {
  const payload = JSON.parse(JSON.stringify(form)) as Record<string, any>;

  if ('company_id' in payload) {
    delete payload.company_id;
  }

  ['order_date', 'estimated_ship_date', 'actual_ship_date'].forEach((field) => {
    if (payload[field] === '') {
      payload[field] = null;
    }
  });

  if (Array.isArray(payload.shipping_tracking_numbers)) {
    const filtered = payload.shipping_tracking_numbers
      .filter((item: any) => item.number && item.number.trim())
      .map((item: any) => ({
        ...item,
        number: item.number.trim(),
        label: item.label?.trim() || undefined,
      }));
    // 如果过滤后为空数组，删除该字段（不发送到后端）
    if (filtered.length === 0) {
      delete payload.shipping_tracking_numbers;
    } else {
      payload.shipping_tracking_numbers = filtered;
    }
  }

  if (Array.isArray(payload.images)) {
    const filtered = payload.images.filter((image: string) => !!image);
    // 如果过滤后为空数组，删除该字段（不发送到后端）
    if (filtered.length === 0) {
      delete payload.images;
    } else {
      payload.images = filtered;
    }
  }

  if (payload.customer_code === '') {
    delete payload.customer_code;
  }

  return payload as Partial<Order>;
};

const handleSubmit = async () => {
  if (!formRef.value || !props.order || !props.order.id) {
    ElMessage.warning('订单信息不完整，无法更新');
    return;
  }

  await formRef.value.validate(async (valid) => {
    if (valid) {
      loading.value = true;
      try {
        if (isCustomerReadOnly.value) {
          await ordersApi.updateCustomerOrderNumber(
            props.order!.id,
            form.customer_order_number || ''
          );
          ElMessage.success('客户订单编号更新成功');
        } else {
          const payload = buildUpdatePayload();
          await ordersStore.updateOrder(props.order!.id, payload);
          if (canManageCompanies.value) {
            await customerCompaniesStore.refresh();
          }
          ElMessage.success('订单更新成功');
        }
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

onMounted(() => {
  // 加载配置选项和客户列表
  loadOrderTypes();
  loadOrderStatuses();
  if (canManageCompanies.value) {
    loadCompanies();
  }
  
  // 初始化布局
  updateLayout();
  window.addEventListener('resize', updateLayout);
  
  // 添加全局粘贴事件监听（捕获阶段，确保能捕获到）- 仅在桌面端
  if (!isMobile.value) {
    const pasteHandler = (e: Event) => {
      handlePaste(e as ClipboardEvent);
    };
    window.addEventListener('paste', pasteHandler, true);
    
    // 保存处理器引用以便卸载时移除
    (window as any).__editDialogPasteHandler = pasteHandler;
  }
});

onUnmounted(() => {
  // 移除事件监听
  window.removeEventListener('resize', updateLayout);
  
  // 移除全局粘贴事件监听
  const pasteHandler = (window as any).__editDialogPasteHandler;
  if (pasteHandler) {
    window.removeEventListener('paste', pasteHandler, true);
    delete (window as any).__editDialogPasteHandler;
  }
});
</script>

<style scoped>
/* 粘贴提示框 - 始终显示在顶部 */
.paste-hint-box {
  width: 100%;
  margin-bottom: 12px;
  padding: 14px 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  border: 2px solid #409eff;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
}

.paste-hint-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.paste-icon {
  font-size: 24px;
  color: #fff;
  flex-shrink: 0;
}

.paste-hint-text {
  flex: 1;
  color: #fff;
  font-size: 14px;
  line-height: 1.6;
}

.paste-hint-text strong {
  font-weight: 600;
  font-size: 15px;
  margin-right: 8px;
}

.paste-hint-text kbd {
  display: inline-block;
  padding: 4px 10px;
  margin: 0 4px;
  background-color: #fff;
  color: #409eff;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.image-upload-area {
  min-height: 100px;
  padding: 20px;
  border: 2px dashed #dcdfe6;
  border-radius: 4px;
  transition: all 0.3s;
  outline: none;
}

.image-upload-area:hover {
  border-color: #409eff;
  background-color: #f5f7fa;
}

.image-upload-area:focus {
  border-color: #409eff;
  background-color: #f0f9ff;
}

.image-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 10px;
}

.image-item {
  position: relative;
  width: 100px;
  height: 100px;
}

.preview-image {
  width: 100%;
  height: 100%;
  border-radius: 4px;
  border: 1px solid #dcdfe6;
}

.remove-image-btn {
  position: absolute;
  top: -8px;
  right: -8px;
}

.upload-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.upload-tips {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 6px;
  border: 1px solid #e4e7ed;
  margin-top: 8px;
}

.tip-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: #ffffff;
}

.tip-item .el-icon {
  font-size: 16px;
  color: #fff;
}

.tip-item.highlight {
  color: #fff;
  font-weight: 600;
  font-size: 15px;
  padding: 8px;
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}

.tip-item kbd {
  display: inline-block;
  padding: 3px 8px;
  margin: 0 3px;
  background-color: #fff;
  color: #409eff;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.tracking-list {
  margin-bottom: 10px;
}

.tracking-item {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

/* 移动端优化 */
@media (max-width: 768px) {
  .order-edit-dialog :deep(.el-dialog) {
    margin: 5vh auto !important;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
  }

  .order-edit-dialog :deep(.el-dialog__body) {
    flex: 1;
    overflow-y: auto;
    padding: 15px;
    -webkit-overflow-scrolling: touch;
  }

  .order-edit-form :deep(.el-form-item) {
    margin-bottom: 18px;
  }

  .order-edit-form :deep(.el-form-item__label) {
    font-size: 13px;
    line-height: 1.5;
    padding-bottom: 4px;
  }

  .order-edit-form :deep(.el-input),
  .order-edit-form :deep(.el-select),
  .order-edit-form :deep(.el-date-editor) {
    width: 100% !important;
  }

  .order-edit-form :deep(.el-textarea__inner) {
    font-size: 14px;
  }

  .tracking-item {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .tracking-item .el-select,
  .tracking-item .el-input {
    width: 100% !important;
    margin: 0 !important;
  }

  .image-item {
    width: 80px;
    height: 80px;
  }

  .paste-hint-box {
    padding: 10px 12px;
  }

  .paste-hint-text {
    font-size: 12px;
  }

  .paste-hint-text strong {
    font-size: 13px;
  }

  .upload-tips {
    padding: 12px;
  }

  .tip-item {
    font-size: 12px;
  }
}

@media (max-width: 480px) {
  .order-edit-dialog :deep(.el-dialog) {
    margin: 2vh auto !important;
    max-height: 96vh;
  }

  .order-edit-dialog :deep(.el-dialog__header) {
    padding: 15px;
  }

  .order-edit-dialog :deep(.el-dialog__title) {
    font-size: 16px;
  }

  .order-edit-dialog :deep(.el-dialog__body) {
    padding: 12px;
  }

  .order-edit-form :deep(.el-form-item) {
    margin-bottom: 15px;
  }

  .order-edit-form :deep(.el-form-item__label) {
    font-size: 12px;
  }

  .image-upload-area {
    padding: 15px;
    min-height: 80px;
  }

  .image-item {
    width: 70px;
    height: 70px;
  }
}

/* 移动端日期选择器优化 */
:deep(.mobile-datetime-picker-popper) {
  width: 100vw !important;
  max-width: 100vw !important;
  left: 0 !important;
  right: 0 !important;
  margin: 0 !important;
  position: fixed !important;
  top: 0 !important;
  bottom: 0 !important;
  height: 100vh !important;
  z-index: 3000 !important;
}

:deep(.mobile-datetime-picker-popper .el-picker__panel) {
  width: 100% !important;
  height: 100% !important;
  margin: 0 !important;
  border-radius: 0 !important;
  display: flex !important;
  flex-direction: column !important;
}

:deep(.mobile-datetime-picker-popper .el-date-picker__header) {
  padding: 15px 20px;
  border-bottom: 1px solid #e4e7ed;
}

:deep(.mobile-datetime-picker-popper .el-picker-panel__content) {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

:deep(.mobile-datetime-picker-popper .el-time-panel) {
  width: 100% !important;
  margin: 0 !important;
}

:deep(.mobile-datetime-picker-popper .el-time-spinner__wrapper) {
  width: 100% !important;
}

@media (max-width: 768px) {
  :deep(.mobile-datetime-picker-popper) {
    width: 100vw !important;
    max-width: 100vw !important;
  }
}
</style>

