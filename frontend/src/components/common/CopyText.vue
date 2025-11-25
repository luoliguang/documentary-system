<template>
  <div class="copy-text" :class="{ 'copy-text--block': !inline }">
    <span v-if="label" class="copy-text__label">{{ label }}</span>
    <div class="copy-text__content">
      <span class="copy-text__value" :title="displayText">
        {{ displayText }}
      </span>
      <el-tooltip :content="tooltipContent" placement="top">
        <button class="copy-text__button" type="button" @click.stop="handleCopy">
          <el-icon><CopyDocument /></el-icon>
        </button>
      </el-tooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { CopyDocument } from '@element-plus/icons-vue';

const props = defineProps({
  text: {
    type: [String, Number],
    default: '',
  },
  label: {
    type: String,
    default: '',
  },
  placeholder: {
    type: String,
    default: '-',
  },
  inline: {
    type: Boolean,
    default: true,
  },
});

const copyState = ref<'idle' | 'copied'>('idle');

const displayText = computed(() => {
  if (props.text === 0 || props.text === '0') {
    return String(props.text);
  }
  return props.text ? String(props.text) : props.placeholder;
});

const tooltipContent = computed(() =>
  copyState.value === 'copied' ? '已复制' : '点击复制'
);

const handleCopy = async () => {
  if (!props.text && props.text !== 0) {
    ElMessage.warning('暂无可复制内容');
    return;
  }

  const value = String(props.text);
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    copyState.value = 'copied';
    ElMessage.success('复制成功');
    setTimeout(() => {
      copyState.value = 'idle';
    }, 1500);
  } catch (error) {
    console.error('复制失败:', error);
    ElMessage.error('复制失败，请手动复制');
  }
};
</script>

<style scoped>
.copy-text {
  display: inline-flex;
  flex-direction: column;
  gap: 4px;
}

.copy-text--block {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.copy-text__label {
  font-size: 12px;
  color: #909399;
}

.copy-text__content {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.copy-text__value {
  font-weight: 600;
  color: #303133;
  max-width: 160px;
  display: inline-block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.copy-text--block .copy-text__value {
  max-width: 100%;
}

.copy-text__button {
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #409eff;
}

.copy-text__button:hover {
  color: #66b1ff;
}
</style>

