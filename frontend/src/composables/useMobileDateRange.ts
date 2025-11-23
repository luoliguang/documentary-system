import { ref, watch, computed } from 'vue';

/**
 * 手机端日期范围选择器组合式函数
 * 提供统一的手机端和桌面端日期范围选择功能
 * 
 * @param options 配置选项
 * @returns 日期范围相关的响应式数据和方法
 */
export function useMobileDateRange(options: {
  /** 是否启用移动端检测（默认 true） */
  enableMobileDetection?: boolean;
  /** 移动端断点（默认 768px） */
  mobileBreakpoint?: number;
} = {}) {
  const {
    enableMobileDetection = true,
    mobileBreakpoint = 768,
  } = options;

  // 移动端检测
  const isMobile = ref(
    enableMobileDetection ? window.innerWidth <= mobileBreakpoint : false
  );

  // 桌面端：日期范围字段
  const dateRange = ref<string[]>([]);

  // 手机端：独立的开始和结束日期字段
  const dateStart = ref<string>('');
  const dateEnd = ref<string>('');

  // 监听窗口大小变化
  let handleResize: (() => void) | null = null;
  if (enableMobileDetection) {
    handleResize = () => {
      const wasMobile = isMobile.value;
      isMobile.value = window.innerWidth <= mobileBreakpoint;

      // 当从手机端切换到桌面端时，同步日期范围
      if (!isMobile.value && wasMobile && dateStart.value && dateEnd.value) {
        dateRange.value = [dateStart.value, dateEnd.value];
      }
      // 当从桌面端切换到手机端时，同步独立日期
      else if (isMobile.value && !wasMobile && dateRange.value && dateRange.value.length === 2) {
        dateStart.value = dateRange.value[0] || '';
        dateEnd.value = dateRange.value[1] || '';
      }
    };

    window.addEventListener('resize', handleResize);
  }

  /**
   * 清理函数，应该在组件卸载时调用
   */
  const cleanup = () => {
    if (handleResize) {
      window.removeEventListener('resize', handleResize);
      handleResize = null;
    }
  };

  // 监听手机端日期变化，同步到日期范围（用于兼容）
  watch(
    () => [dateStart.value, dateEnd.value],
    ([start, end]) => {
      if (isMobile.value) {
        if (start && end) {
          dateRange.value = [start, end];
        } else if (start || end) {
          dateRange.value = [start || '', end || ''];
        } else {
          dateRange.value = [];
        }
      }
    }
  );

  // 监听桌面端日期范围变化，同步到独立日期（用于兼容）
  watch(
    () => dateRange.value,
    (range) => {
      if (!isMobile.value && range && range.length === 2) {
        dateStart.value = range[0] || '';
        dateEnd.value = range[1] || '';
      }
    }
  );

  /**
   * 构建查询参数
   * @param options 配置选项
   * @returns 包含开始和结束日期的对象
   */
  const buildQueryParams = (options: {
    /** 开始日期的时间部分（默认 '00:00:00'） */
    startTime?: string;
    /** 结束日期的时间部分（默认 '23:59:59'） */
    endTime?: string;
    /** 结束日期是否加一天（默认 false） */
    addOneDayToEnd?: boolean;
  } = {}) => {
    const {
      startTime = '00:00:00',
      endTime = '23:59:59',
      addOneDayToEnd = false,
    } = options;

    let start: string | undefined;
    let end: string | undefined;

    // 桌面端：从日期范围获取
    if (dateRange.value && dateRange.value.length === 2) {
      const [rangeStart, rangeEnd] = dateRange.value;
      if (rangeStart) {
        start = `${rangeStart} ${startTime}`;
      }
      if (rangeEnd) {
        if (addOneDayToEnd) {
          const endDate = new Date(`${rangeEnd}T00:00:00Z`);
          endDate.setUTCDate(endDate.getUTCDate() + 1);
          const year = endDate.getUTCFullYear();
          const month = String(endDate.getUTCMonth() + 1).padStart(2, '0');
          const day = String(endDate.getUTCDate()).padStart(2, '0');
          end = `${year}-${month}-${day} ${endTime}`;
        } else {
          end = `${rangeEnd} ${endTime}`;
        }
      }
    }
    // 手机端：从独立的开始和结束日期获取
    else if (isMobile.value) {
      if (dateStart.value) {
        start = `${dateStart.value} ${startTime}`;
      }
      if (dateEnd.value) {
        if (addOneDayToEnd) {
          const endDate = new Date(`${dateEnd.value}T00:00:00Z`);
          endDate.setUTCDate(endDate.getUTCDate() + 1);
          const year = endDate.getUTCFullYear();
          const month = String(endDate.getUTCMonth() + 1).padStart(2, '0');
          const day = String(endDate.getUTCDate()).padStart(2, '0');
          end = `${year}-${month}-${day} ${endTime}`;
        } else {
          end = `${dateEnd.value} ${endTime}`;
        }
      }
    }

    return { start, end };
  };

  /**
   * 重置所有日期字段
   */
  const reset = () => {
    dateRange.value = [];
    dateStart.value = '';
    dateEnd.value = '';
  };

  /**
   * 检查是否有日期筛选
   */
  const hasDateFilter = computed(() => {
    if (isMobile.value) {
      return !!(dateStart.value || dateEnd.value);
    }
    return !!(dateRange.value && dateRange.value.length === 2);
  });

  return {
    // 响应式数据
    isMobile,
    dateRange,
    dateStart,
    dateEnd,
    hasDateFilter,
    // 方法
    buildQueryParams,
    reset,
    cleanup,
  };
}

