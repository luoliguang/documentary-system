import { WebSocketServer, WebSocket } from 'ws';

let wss: WebSocketServer | null = null;

export function initWebSocket(port: number = 3007) {
  if (wss) return wss;
  
  wss = new WebSocketServer({ port, path: '/ws' });
  
  wss.on('connection', (ws: WebSocket) => {
    console.log('✅ WebSocket客户端连接');
    ws.on('close', () => {
      console.log('❌ WebSocket客户端断开');
    });
  });
  
  console.log(`🚀 WebSocket服务器启动在端口 ${port}`);
  return wss;
}

export function broadcast(data: any) {
  if (!wss) return;
  const message = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

