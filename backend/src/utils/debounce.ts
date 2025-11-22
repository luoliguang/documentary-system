/**
 * 防抖工具函数
 * 用于延迟执行函数，避免频繁调用
 */

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * 批量操作工具
 * 用于收集一段时间内的操作，然后批量执行
 */
export class BatchCollector<T> {
  private items: T[] = [];
  private timeout: NodeJS.Timeout | null = null;
  private callback: (items: T[]) => Promise<void> | void;
  private delay: number;

  constructor(callback: (items: T[]) => Promise<void> | void, delay: number = 100) {
    this.callback = callback;
    this.delay = delay;
  }

  add(item: T) {
    this.items.push(item);
    this.schedule();
  }

  private schedule() {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    this.timeout = setTimeout(() => {
      this.flush();
    }, this.delay);
  }

  async flush() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    if (this.items.length > 0) {
      const items = [...this.items];
      this.items = [];
      await this.callback(items);
    }
  }
}

