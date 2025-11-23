<template>
  <div class="general-config-management">
    <!-- 桌面端：表格 -->
    <el-table
      v-if="!isMobile"
      v-loading="loading"
      :data="configs"
      stripe
      style="width: 100%"
      class="desktop-table"
    >
      <el-table-column prop="key" label="配置键" width="250" />
      <el-table-column prop="description" label="描述" />
      <el-table-column label="当前值" width="200">
        <template #default="{ row }">
          <el-tag v-if="typeof row.value === 'number'" type="primary">
            {{ row.value }}
          </el-tag>
          <span v-else>{{ row.value }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" size="small" link @click="handleEdit(row)">
            编辑
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 手机端：卡片列表 -->
    <div v-else v-loading="loading" class="mobile-config-list">
      <transition-group name="config-card" tag="div">
        <el-card
          v-for="config in configs"
          :key="config.key"
          class="config-card"
          shadow="hover"
        >
          <div class="config-card-header">
            <div class="config-key">{{ config.key }}</div>
            <el-button type="primary" size="small" @click="handleEdit(config)">
              编辑
            </el-button>
          </div>
          <div class="config-card-body">
            <div v-if="config.description" class="config-field">
              <span class="field-label">描述：</span>
              <span class="field-value">{{ config.description }}</span>
            </div>
            <div class="config-field">
              <span class="field-label">当前值：</span>
              <el-tag v-if="typeof config.value === 'number'" type="primary" size="small">
                {{ config.value }}
              </el-tag>
              <span v-else class="field-value">{{ config.value }}</span>
            </div>
          </div>
        </el-card>
      </transition-group>
    </div>

    <!-- 编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="`编辑配置：${editingConfig?.key || ''}`"
      :width="dialogWidth"
      class="config-edit-dialog"
    >
      <el-form :model="form" :label-width="labelWidth">
        <el-form-item label="配置键">
          <el-input v-model="form.key" disabled />
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="2"
            placeholder="配置说明"
          />
        </el-form-item>
        <el-form-item
          :label="getValueLabel(form.key)"
          :required="true"
        >
          <el-input-number
            v-if="isNumberConfig(form.key)"
            v-model="form.value"
            :min="getMinValue(form.key)"
            :max="getMaxValue(form.key)"
            :step="1"
            style="width: 100%"
          />
          <el-input
            v-else
            v-model="form.value"
            type="textarea"
            :rows="4"
            placeholder="配置值"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { configsApi } from '../../../api/configs';

const isMobile = computed(() => window.innerWidth <= 768);
const dialogWidth = computed(() => (isMobile.value ? '95%' : '600px'));
const labelWidth = computed(() => (isMobile.value ? '80px' : '120px'));

interface ConfigItem {
  key: string;
  value: any;
  description: string | null;
  type: string;
  updatedAt: string | null;
}

const loading = ref(false);
const submitting = ref(false);
const configs = ref<ConfigItem[]>([]);
const dialogVisible = ref(false);
const editingConfig = ref<ConfigItem | null>(null);

const form = ref({
  key: '',
  value: null as any,
  description: '',
});

// 通用配置键定义
const CONFIG_KEYS = {
  REMINDER_MIN_INTERVAL_HOURS: 'reminder_min_interval_hours',
  DEFAULT_PAGE_SIZE: 'default_page_size',
} as const;

const CONFIG_METADATA: Record<string, {
  label: string;
  description: string;
  min?: number;
  max?: number;
}> = {
  [CONFIG_KEYS.REMINDER_MIN_INTERVAL_HOURS]: {
    label: '催货最小间隔（小时）',
    description: '客户两次催货之间的最小时间间隔（单位：小时）',
    min: 0.5,
    max: 24,
  },
  [CONFIG_KEYS.DEFAULT_PAGE_SIZE]: {
    label: '默认分页大小',
    description: '列表页面的默认每页显示数量',
    min: 1,
    max: 100,
  },
};

const isNumberConfig = (key: string): boolean => {
  return [
    CONFIG_KEYS.REMINDER_MIN_INTERVAL_HOURS,
    CONFIG_KEYS.DEFAULT_PAGE_SIZE,
  ].includes(key as any);
};

const getValueLabel = (key: string): string => {
  return CONFIG_METADATA[key]?.label || '配置值';
};

const getMinValue = (key: string): number => {
  return CONFIG_METADATA[key]?.min ?? 0;
};

const getMaxValue = (key: string): number => {
  return CONFIG_METADATA[key]?.max ?? 1000;
};

const loadConfigs = async () => {
  try {
    loading.value = true;
    const response = await configsApi.getConfigs({ type: 'general' }) as { configs?: ConfigItem[] };
    const allConfigs = response.configs || [];
    
    // 只显示通用配置项
    const generalConfigKeys = [
      CONFIG_KEYS.REMINDER_MIN_INTERVAL_HOURS,
      CONFIG_KEYS.DEFAULT_PAGE_SIZE,
    ];
    
    configs.value = generalConfigKeys.map(key => {
      const config = allConfigs.find((c: ConfigItem) => c.key === key);
      if (config) {
        return config;
      }
      // 如果配置不存在，创建默认项
      return {
        key,
        value: CONFIG_METADATA[key]?.min || 0,
        description: CONFIG_METADATA[key]?.description || null,
        type: 'general',
        updatedAt: null,
      };
    });
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '加载配置失败');
  } finally {
    loading.value = false;
  }
};

const handleEdit = (config: ConfigItem) => {
  editingConfig.value = config;
  form.value = {
    key: config.key,
    value: config.value,
    description: config.description || CONFIG_METADATA[config.key]?.description || '',
  };
  dialogVisible.value = true;
};

const handleSubmit = async () => {
  if (form.value.value === null || form.value.value === undefined) {
    ElMessage.warning('配置值不能为空');
    return;
  }

  try {
    submitting.value = true;
    await configsApi.updateConfig(form.value.key, {
      config_value: form.value.value,
      description: form.value.description,
      type: 'general',
    });
    ElMessage.success('配置更新成功');
    dialogVisible.value = false;
    await loadConfigs();
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '更新配置失败');
  } finally {
    submitting.value = false;
  }
};

onMounted(() => {
  loadConfigs();
});
</script>

<style scoped>
.general-config-management {
  padding: 20px 0;
}

/* 桌面端表格显示 */
.desktop-table {
  display: block;
}

@media (max-width: 768px) {
  .desktop-table {
    display: none;
  }

  .mobile-config-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .config-card {
    border-radius: 8px;
  }

  .config-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid #e5e9f2;
  }

  .config-key {
    font-size: 15px;
    font-weight: 600;
    color: #1f2d3d;
    word-break: break-word;
    flex: 1;
    margin-right: 12px;
  }

  .config-card-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .config-field {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 13px;
  }

  .field-label {
    color: #909399;
    min-width: 60px;
    flex-shrink: 0;
  }

  .field-value {
    color: #303133;
    flex: 1;
    word-break: break-word;
  }

  /* 对话框优化 */
  .config-edit-dialog :deep(.el-dialog) {
    margin: 5vh auto !important;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
  }

  .config-edit-dialog :deep(.el-dialog__body) {
    flex: 1;
    overflow-y: auto;
    padding: 15px;
    -webkit-overflow-scrolling: touch;
  }

  .config-edit-dialog :deep(.el-form-item) {
    margin-bottom: 18px;
  }

  .config-edit-dialog :deep(.el-form-item__label) {
    font-size: 13px;
  }
}

@media (max-width: 480px) {
  .config-edit-dialog :deep(.el-dialog) {
    margin: 2vh auto !important;
    max-height: 96vh;
  }

  .config-edit-dialog :deep(.el-dialog__body) {
    padding: 12px;
  }
}

/* 过渡动画 */
.config-card-enter-active,
.config-card-leave-active {
  transition: all 0.25s ease;
}

.config-card-enter-from,
.config-card-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>

