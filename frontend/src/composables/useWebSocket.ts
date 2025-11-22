import { onUnmounted } from 'vue';
import { connectWebSocket, unregisterHandler } from '../utils/websocket';

/**
 * WebSocket composable
 * 简化 WebSocket 的使用，自动处理连接和清理
 */
export function useWebSocket() {
  const handlers: Set<(data: any) => void> = new Set();

  const on = (handler: (data: any) => void) => {
    handlers.add(handler);
    connectWebSocket(handler);
  };

  const off = (handler: (data: any) => void) => {
    handlers.delete(handler);
    unregisterHandler(handler);
  };

  // 组件卸载时清理所有处理器
  onUnmounted(() => {
    handlers.forEach(handler => {
      unregisterHandler(handler);
    });
    handlers.clear();
  });

  return {
    on,
    off,
  };
}

