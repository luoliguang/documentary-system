import { ref, onUnmounted } from 'vue';
import { remindersApi } from '../api/reminders';

interface ReminderStats {
  total_count: number;
  visible_count?: number;
  last_reminder_time: string | null;
  next_reminder_time: string | null;
  interval_hours: number;
}

/**
 * 催货统计和节流管理 Composable
 */
export function useReminderStats() {
  const statsMap = ref<Map<number, ReminderStats>>(new Map());
  const countdownTimers = ref<Map<number, number>>(new Map());

  /**
   * 获取订单的催货统计
   */
  const fetchReminderStats = async (orderId: number): Promise<ReminderStats | null> => {
    try {
      const stats = await remindersApi.getOrderReminderStats(orderId);
      statsMap.value.set(orderId, stats);
      return stats;
    } catch (error: any) {
      // 404 错误是预期行为（订单可能不存在或无权访问），完全静默处理
      // 403 错误也是预期行为（无权访问），完全静默处理
      // 其他错误才记录日志（但不显示错误消息，因为响应拦截器已经处理了）
      if (error.response?.status !== 404 && error.response?.status !== 403) {
        console.error('获取催货统计失败:', error);
      }
      // 确保返回 null，表示没有统计信息
      statsMap.value.delete(orderId);
      return null;
    }
  };

  /**
   * 获取订单的催货统计（从缓存）
   */
  const getReminderStats = (orderId: number): ReminderStats | null => {
    return statsMap.value.get(orderId) || null;
  };

  /**
   * 检查是否可以催货
   */
  const canRemind = (orderId: number): boolean => {
    const stats = statsMap.value.get(orderId);
    if (!stats || !stats.next_reminder_time) {
      return true; // 没有限制或从未催货
    }
    try {
      const nextTime = new Date(stats.next_reminder_time);
      return new Date() >= nextTime;
    } catch (error) {
      return true; // 日期解析失败，允许催货
    }
  };

  /**
   * 获取剩余等待时间（秒）
   */
  const getRemainingSeconds = (orderId: number): number => {
    const stats = statsMap.value.get(orderId);
    if (!stats || !stats.next_reminder_time) {
      return 0;
    }
    const nextTime = new Date(stats.next_reminder_time);
    const now = new Date();
    const diff = Math.max(0, Math.floor((nextTime.getTime() - now.getTime()) / 1000));
    return diff;
  };

  /**
   * 格式化剩余时间
   */
  const formatRemainingTime = (seconds: number): string => {
    if (seconds <= 0) return '';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    } else if (minutes > 0) {
      return `${minutes}分钟${secs}秒`;
    } else {
      return `${secs}秒`;
    }
  };

  /**
   * 启动倒计时（用于实时更新）
   */
  const startCountdown = (orderId: number, callback?: (remaining: number) => void) => {
    // 清除之前的定时器
    const existingTimer = countdownTimers.value.get(orderId);
    if (existingTimer) {
      clearInterval(existingTimer);
    }

    // 立即计算并设置初始剩余时间，避免显示0
    const initialRemaining = getRemainingSeconds(orderId);
    if (callback && initialRemaining > 0) {
      callback(initialRemaining);
    }

    // 如果已经可以催货，不需要启动定时器
    if (initialRemaining <= 0) {
      if (callback) {
        callback(0);
      }
      return;
    }

    const timer = window.setInterval(() => {
      const remaining = getRemainingSeconds(orderId);
      if (callback) {
        callback(remaining);
      }
      if (remaining <= 0) {
        clearInterval(timer);
        countdownTimers.value.delete(orderId);
        if (callback) {
          callback(0);
        }
      }
    }, 1000);

    countdownTimers.value.set(orderId, timer);
  };

  /**
   * 停止倒计时
   */
  const stopCountdown = (orderId: number) => {
    const timer = countdownTimers.value.get(orderId);
    if (timer) {
      clearInterval(timer);
      countdownTimers.value.delete(orderId);
    }
  };

  /**
   * 刷新统计信息（催货成功后调用）
   */
  const refreshStats = async (orderId: number) => {
    await fetchReminderStats(orderId);
  };

  /**
   * 清理所有定时器
   */
  const cleanup = () => {
    countdownTimers.value.forEach((timer) => {
      clearInterval(timer);
    });
    countdownTimers.value.clear();
  };

  // 组件卸载时清理
  onUnmounted(() => {
    cleanup();
  });

  return {
    statsMap,
    fetchReminderStats,
    getReminderStats,
    canRemind,
    getRemainingSeconds,
    formatRemainingTime,
    startCountdown,
    stopCountdown,
    refreshStats,
    cleanup,
  };
}

