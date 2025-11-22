let ws: WebSocket | null = null;
let reconnectTimer: number | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10; // 最大重连次数
const RECONNECT_DELAY = 3000; // 重连延迟（毫秒）
const messageHandlers: Set<(data: any) => void> = new Set();

/**
 * 构建WebSocket URL
 * 优先级：
 * 1. 环境变量 VITE_WS_URL（完整URL）
 * 2. 环境变量 VITE_WS_PORT + 当前协议和主机
 * 3. 自动检测：生产环境（HTTPS）使用标准端口（443），开发环境使用3007
 */
function buildWebSocketUrl(): string {
  // 优先使用完整的环境变量URL
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.hostname;
  const port = import.meta.env.VITE_WS_PORT;

  // 如果指定了端口，使用指定端口
  if (port) {
    return `${protocol}//${host}:${port}/ws`;
  }

  // 生产环境（HTTPS）：使用标准端口（443），不显示端口号（通过Nginx代理）
  // 开发环境（HTTP）：使用3007端口
  if (protocol === 'wss:') {
    // HTTPS环境，假设通过Nginx代理，使用标准端口
    return `${protocol}//${host}/ws`;
  } else {
    // HTTP环境，使用3007端口
    return `${protocol}//${host}:3007/ws`;
  }
}

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

  // 检查重连次数
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error('❌ WebSocket重连次数已达上限，停止重连');
    return null;
  }

  // 构建WebSocket URL
  const wsUrl = buildWebSocketUrl();
  // console.log(`🔌 尝试连接WebSocket: ${wsUrl}`);
  
  try {
    ws = new WebSocket(wsUrl);
  } catch (error) {
    // console.error('❌ 创建WebSocket连接失败:', error);
    reconnectAttempts++;
    return null;
  }

  ws.onopen = () => {
    // console.log('✅ WebSocket连接成功');
    reconnectAttempts = 0; // 重置重连次数
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

  ws.onerror = () => {
    // console.error('❌ WebSocket错误:', error);
    // 不在这里重连，让onclose处理
  };

  ws.onclose = (event) => {
    const { code, wasClean } = event;
    // console.log(`❌ WebSocket连接关闭 (code: ${code}, reason: ${reason || '无'}, clean: ${wasClean})`);
    
    // 清理当前连接
    ws = null;

    // 如果是正常关闭（code 1000），不重连
    if (wasClean && code === 1000) {
      console.log('WebSocket正常关闭，不重连');
      return;
    }

    // 检查重连次数
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      // console.error('❌ WebSocket重连次数已达上限，停止重连');
      return;
    }

    reconnectAttempts++;
    const delay = Math.min(RECONNECT_DELAY * reconnectAttempts, 30000); // 指数退避，最大30秒
    // console.log(`🔄 ${delay / 1000}秒后尝试第 ${reconnectAttempts} 次重连...`);
    
    reconnectTimer = window.setTimeout(() => {
      // 重新连接时保留所有处理器
      connectWebSocket(() => {}); // 空函数，因为处理器已注册
    }, delay);
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
    ws.close(1000, '主动断开连接'); // 正常关闭
    ws = null;
  }
  reconnectAttempts = 0; // 重置重连次数
}

/**
 * 重置WebSocket连接（用于切换环境或重新初始化）
 */
export function resetWebSocket() {
  disconnectWebSocket();
  reconnectAttempts = 0;
  messageHandlers.clear();
}

