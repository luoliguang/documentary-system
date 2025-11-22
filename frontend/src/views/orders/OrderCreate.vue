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
            placeholder="请输入订单编号（必填）"
            clearable
            style="width: 100%"
          />
          <div style="font-size: 12px; color: #909399; margin-top: 4px">
            提示：订单编号是唯一标识，请确保不重复
          </div>
        </el-form-item>

        <el-form-item label="客户公司" prop="company_id">
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
            提示：选择客户公司后，系统会自动关联该公司的第一个客户账号
          </div>
        </el-form-item>
        
        <el-form-item v-if="form.company_id && companyCustomers.length > 0" label="关联客户账号" prop="customer_id">
          <el-select
            v-model="form.customer_id"
            placeholder="请选择具体客户账号"
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
          <div style="font-size: 12px; color: #909399; margin-top: 4px">
            提示：该公司的所有账号都会看到此订单
          </div>
        </el-form-item>
        <el-form-item v-else-if="form.company_id && companyCustomers.length === 0" label="关联客户账号">
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

        <el-form-item label="客户订单编号">
          <el-input
            v-model="form.customer_order_number"
            placeholder="请输入客户订单编号（可选）"
            clearable
          />
        </el-form-item>

        <el-form-item label="订单类型" prop="order_type">
          <el-select v-model="form.order_type" placeholder="请选择订单类型">
            <el-option
              v-for="type in orderTypes"
              :key="type.value"
              :label="type.label"
              :value="type.value"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="订单状态" prop="status">
          <el-select v-model="form.status" placeholder="请选择状态">
            <el-option
              v-for="status in orderStatuses"
              :key="status.value"
              :label="status.label"
              :value="status.value"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="是否可以出货">
          <el-switch v-model="form.can_ship" />
        </el-form-item>

        <el-form-item label="下单时间" prop="order_date">
          <el-date-picker
            v-model="form.order_date"
            type="datetime"
            placeholder="请选择下单时间"
            style="width: 100%"
            value-format="YYYY-MM-DD HH:mm:ss"
            format="YYYY-MM-DD HH:mm"
            :disabled-date="disabledFutureDate"
          />
          <div style="font-size: 12px; color: #909399; margin-top: 4px">
            提示：下单时间不能晚于当前时间
          </div>
        </el-form-item>

        <el-form-item label="预计出货日期">
          <el-date-picker
            v-model="form.estimated_ship_date"
            type="datetime"
            placeholder="请选择预计出货日期和时间"
            style="width: 100%"
            value-format="YYYY-MM-DD HH:mm:ss"
            format="YYYY-MM-DD HH:mm"
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
        
        <el-form-item label="订单图片">
          <!-- 粘贴提示区域 - 始终显示 -->
          <div class="paste-hint-box">
            <div class="paste-hint-content">
              <el-icon class="paste-icon"><DocumentCopy /></el-icon>
              <div class="paste-hint-text">
                <strong>快速粘贴图片：</strong>
                <span>复制图片后，在此页面按 <kbd>Ctrl+V</kbd> 或 <kbd>Cmd+V</kbd> 即可上传</span>
              </div>
            </div>
          </div>
          
          <div 
            ref="uploadAreaRef"
            style="width: 100%"
            class="image-upload-area"
            tabindex="0"
            @paste="handlePaste"
            @dragover.prevent
            @drop.prevent="handleDrop"
            @focus="handleFocus"
            @blur="handleBlur"
          >
            <div v-if="form.images && form.images.length > 0" class="image-list">
              <div v-for="(image, index) in form.images" :key="index" class="image-item">
                <el-image :src="image" fit="cover" class="preview-image" />
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
                <div class="tip-item">
                  <el-icon><UploadFilled /></el-icon>
                  <span>或直接拖拽图片文件到此处</span>
                </div>
              </div>
            </div>
          </div>
        </el-form-item>

        <el-form-item label="发货单号">
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
            <div style="font-size: 12px; color: #909399; margin-top: 4px">
              提示：可以在创建订单后添加发货单号，也可以在编辑订单时添加
            </div>
          </div>
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
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { Delete, Upload, Picture, DocumentCopy, UploadFilled } from '@element-plus/icons-vue';
import { ordersApi } from '../../api/orders';
import { useAuthStore } from '../../stores/auth';
import { useConfigOptions } from '../../composables/useConfigOptions';
import type { ShippingTrackingNumber } from '../../types';

const router = useRouter();
const authStore = useAuthStore();
const formRef = ref<FormInstance>();
const loading = ref(false);
const companies = ref<any[]>([]);
const companyCustomers = ref<any[]>([]);
const uploadAreaRef = ref<HTMLElement | null>(null);
const isUploadAreaFocused = ref(false);

// 配置选项
const { orderTypes, orderStatuses, loadOrderTypes, loadOrderStatuses } = useConfigOptions();

// 获取当前时间并格式化为 YYYY-MM-DD HH:mm:ss
const getCurrentDateTime = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

const form = reactive({
  order_number: '',
  company_id: undefined as number | undefined,
  customer_id: undefined as number | undefined,
  customer_code: '',
  customer_order_number: '',
  order_type: 'required' as 'required' | 'scattered' | 'photo',
  status: 'pending' as 'pending' | 'in_production' | 'completed' | 'shipped' | 'cancelled',
  can_ship: false,
  order_date: getCurrentDateTime(), // 默认当前时间
  estimated_ship_date: '',
  notes: '',
  internal_notes: '',
  images: [] as string[],
  shipping_tracking_numbers: [] as ShippingTrackingNumber[],
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
  order_number: [
    { required: true, message: '请输入订单编号', trigger: 'blur' },
  ],
  company_id: [
    { required: true, message: '请选择客户公司', trigger: 'change' },
  ],
  customer_id: [
    { required: true, message: '请选择客户账号', trigger: 'change' },
  ],
  status: [
    { required: true, message: '请选择订单状态', trigger: 'change' },
  ],
  order_date: [
    { required: true, message: '请选择下单时间', trigger: 'change' },
  ],
};

// 禁用未来日期和时间
const disabledFutureDate = (time: Date) => {
  const now = new Date();
  return time.getTime() > now.getTime();
};

const loadCompanies = async (search?: string) => {
  try {
    const response = await ordersApi.getCustomerCompanies({ search });
    companies.value = response.companies;
    
    // 如果已选择公司，加载该公司的客户列表
    if (form.company_id) {
      await loadCompanyCustomers(form.company_id);
    }
  } catch (error) {
    ElMessage.error('加载客户公司列表失败');
  }
};

const loadCompanyCustomers = async (companyId: number) => {
  try {
    // 直接通过 company_id 查询该公司的所有客户
    const response = await ordersApi.getCustomers({ company_id: companyId });
    companyCustomers.value = response.customers;
    
    // 自动选择第一个客户账号
    if (companyCustomers.value.length > 0 && !form.customer_id) {
      const firstCustomerId = companyCustomers.value[0].id;
      form.customer_id = firstCustomerId;
      handleCustomerChange(firstCustomerId);
    }
  } catch (error) {
    ElMessage.error('加载客户列表失败');
  }
};

const handleCompanySearch = (search: string) => {
  if (search) {
    loadCompanies(search);
  } else {
    loadCompanies();
  }
};

const handleCompanyChange = async (companyId: number) => {
  form.customer_id = undefined;
  form.customer_code = '';
  companyCustomers.value = [];
  
  if (companyId) {
    await loadCompanyCustomers(companyId);
  }
};

const handleCustomerChange = (customerId: number) => {
  const customer = companyCustomers.value.find((c) => c.id === customerId);
  if (customer) {
    form.customer_code = customer.customer_code;
  }
};

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
  form.images.push(imageUrl);
  ElMessage.success('图片上传成功');
};

const removeImage = (index: number) => {
  form.images.splice(index, 1);
};

const handleFocus = () => {
  isUploadAreaFocused.value = true;
};

const handleBlur = () => {
  isUploadAreaFocused.value = false;
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
  form.shipping_tracking_numbers.push({
    type: 'main' as ShippingTrackingNumber['type'],
    number: '',
    label: '',
  });
};

const removeTrackingNumber = (index: number) => {
  form.shipping_tracking_numbers.splice(index, 1);
};

const handleSubmit = async () => {
  if (!formRef.value) return;

  await formRef.value.validate(async (valid) => {
    if (valid) {
      // 确保customer_id已设置
      if (!form.customer_id) {
        ElMessage.error('请选择客户账号');
        return;
      }
      
      loading.value = true;
      try {
        // 只传递必要的字段，不传递company_id（后端会自动从customer_id获取）
        const { company_id, ...orderData } = form;
        await ordersApi.createOrder(orderData);
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
  loadCompanies();
  // 加载配置选项
  loadOrderTypes();
  loadOrderStatuses();
  // 添加全局粘贴事件监听（捕获阶段，确保能捕获到）
  const pasteHandler = (e: Event) => {
    handlePaste(e as ClipboardEvent);
  };
  window.addEventListener('paste', pasteHandler, true);
  
  // 保存处理器引用以便卸载时移除
  (window as any).__pasteHandler = pasteHandler;
});

onUnmounted(() => {
  // 移除全局粘贴事件监听
  const pasteHandler = (window as any).__pasteHandler;
  if (pasteHandler) {
    window.removeEventListener('paste', pasteHandler, true);
    delete (window as any).__pasteHandler;
  }
});
</script>

<style scoped>
.order-create {
  width: 100%;
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

.tracking-list {
  margin-bottom: 10px;
}

.tracking-item {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

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
  padding: 10px;
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
</style>

