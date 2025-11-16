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
      <el-form-item v-if="authStore.isAdmin" label="订单类型" prop="order_type">
        <el-select v-model="form.order_type" placeholder="请选择订单类型" style="width: 100%">
          <el-option
            v-for="type in orderTypes"
            :key="type.value"
            :label="type.label"
            :value="type.value"
          />
        </el-select>
      </el-form-item>

      <el-form-item v-if="authStore.isAdmin" label="订单状态" prop="status">
        <el-select v-model="form.status" placeholder="请选择状态" style="width: 100%">
          <el-option
            v-for="status in orderStatuses"
            :key="status.value"
            :label="status.label"
            :value="status.value"
          />
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
          format="YYYY-MM-DD"
          clearable
        />
      </el-form-item>

      <el-form-item v-if="authStore.isAdmin" label="实际出货日期">
        <el-date-picker
          v-model="form.actual_ship_date"
          type="datetime"
          placeholder="请选择实际出货日期和时间"
          style="width: 100%"
          value-format="YYYY-MM-DD HH:mm:ss"
          format="YYYY-MM-DD HH:mm"
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

      <el-form-item v-if="authStore.isAdmin" label="内部备注">
        <el-input
          v-model="form.internal_notes"
          type="textarea"
          :rows="4"
          placeholder="请输入内部备注（仅管理员可见）"
        />
      </el-form-item>

      <el-form-item v-if="authStore.isAdmin" label="订单图片">
        <!-- 粘贴提示区域 - 始终显示 -->
        <div class="paste-hint-box">
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

      <el-form-item v-if="authStore.isAdmin" label="发货单号">
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
const authStore = useAuthStore();
const formRef = ref<FormInstance>();
const loading = ref(false);
const uploadAreaRef = ref<HTMLElement | null>(null);
const isUploadAreaFocused = ref(false);

// 配置选项
const { orderTypes, orderStatuses, loadOrderTypes, loadOrderStatuses } = useConfigOptions();

const form = reactive<Partial<Order> & {
  images: string[];
  shipping_tracking_numbers: Array<{ type: string; number: string; label?: string }>;
}>({
  status: 'pending' as Order['status'],
  is_completed: false,
  can_ship: false,
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
  status: [
    { required: true, message: '请选择订单状态', trigger: 'change' },
  ],
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

watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal && props.order) {
      form.status = props.order.status;
      form.is_completed = props.order.is_completed;
      form.can_ship = props.order.can_ship;
      form.estimated_ship_date = formatDateTimeForPicker(props.order.estimated_ship_date);
      form.actual_ship_date = formatDateTimeForPicker(props.order.actual_ship_date);
      form.notes = props.order.notes || '';
      form.internal_notes = props.order.internal_notes || '';
      form.images = props.order.images ? [...props.order.images] : [];
      form.shipping_tracking_numbers = props.order.shipping_tracking_numbers
        ? [...props.order.shipping_tracking_numbers]
        : [];
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

onMounted(() => {
  // 加载配置选项
  loadOrderTypes();
  loadOrderStatuses();
  // 添加全局粘贴事件监听（捕获阶段，确保能捕获到）
  const pasteHandler = (e: Event) => {
    handlePaste(e as ClipboardEvent);
  };
  window.addEventListener('paste', pasteHandler, true);
  
  // 保存处理器引用以便卸载时移除
  (window as any).__editDialogPasteHandler = pasteHandler;
});

onUnmounted(() => {
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
</style>

