let ws: WebSocket | null = null;
let reconnectTimer: number | null = null;
const messageHandlers: Set<(data: any) => void> = new Set();

export function connectWebSocket(onMessage: (data: any) => void) {
  // 注册消息处理器
  messageHandlers.add(onMessage);

  // 如果已连接，直接返回
  if (ws?.readyState === WebSocket.OPEN) {
    return ws;
  }

  // 如果正在连接中，等待连接完成
  if (ws?.readyState === WebSocket.CONNECTING) {
    return ws;
  }

  // 构建WebSocket URL
  // 优先使用环境变量，否则根据当前协议和主机自动构建
  let wsUrl = import.meta.env.VITE_WS_URL;
  if (!wsUrl) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = import.meta.env.VITE_WS_PORT || '3007';
    wsUrl = `${protocol}//${host}:${port}/ws`;
  }
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('✅ WebSocket连接成功');
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      // 通知所有注册的处理器
      messageHandlers.forEach((handler) => {
        try {
          handler(data);
        } catch (e) {
          console.error('消息处理器错误:', e);
        }
      });
    } catch (e) {
      console.error('WebSocket消息解析失败:', e);
    }
  };

  ws.onerror = (error) => {
    console.error('❌ WebSocket错误:', error);
  };

  ws.onclose = () => {
    console.log('❌ WebSocket连接关闭，3秒后重连...');
    reconnectTimer = window.setTimeout(() => {
      // 重新连接时保留所有处理器
      connectWebSocket(() => {}); // 空函数，因为处理器已注册
    }, 3000);
  };

  return ws;
}

export function unregisterHandler(onMessage: (data: any) => void) {
  messageHandlers.delete(onMessage);
}

export function disconnectWebSocket() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    ws.close();
    ws = null;
  }
}

