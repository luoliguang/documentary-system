import { EventEmitter } from 'events';

/**
 * 简易事件总线，Phase 2 的事件驱动基础设施
 * 当前实现基于 Node.js EventEmitter，后续可以替换为消息队列
 */
class EventBus extends EventEmitter {
  emitEvent<T>(event: string, payload: T): void {
    this.emit(event, payload);
  }

  subscribe<T>(event: string, handler: (payload: T) => void): () => void {
    this.on(event, handler);
    return () => {
      this.off(event, handler);
    };
  }
}

export const eventBus = new EventBus();

