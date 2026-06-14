import { WebSocket, WebSocketServer } from 'ws';
import type { Server as HttpServer } from 'node:http';
import type { IncomingMessage } from 'node:http';
import type { Socket } from 'node:net';
import { logStreamService } from '../services/logStreamService.js';

interface LogsSocketDeps {
  server: HttpServer;
  authService: {
    readLogsSocketTicket(ticket: string): Record<string, any> | null;
  };
}

function rejectUpgrade(socket: Socket, statusCode: number = 401, message: string = 'Unauthorized'): void {
  socket.write(`HTTP/1.1 ${statusCode} ${message}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

export function attachLogsSocketServer({ server, authService }: LogsSocketDeps): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', async (request: IncomingMessage, socket: Socket, head: Buffer): Promise<void> => {
    try {
      const url = new URL(request.url || '/', 'http://localhost');
      if (url.pathname !== '/ws/logs') {
        return;
      }

      const ticket = url.searchParams.get('ticket') || '';
      const session = authService.readLogsSocketTicket(ticket);
      if (!session?.user?.id) {
        rejectUpgrade(socket, 401, 'Unauthorized');
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws: WebSocket): void => {
        wss.emit('connection', ws, request);
      });
    } catch {
      rejectUpgrade(socket, 500, 'Server Error');
    }
  });

  wss.on('connection', async (ws: WebSocket): Promise<void> => {
    const backlog = await logStreamService.getBacklog();
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'backlog', entries: backlog }));
    }

    logStreamService.addSubscriber(ws);

    ws.on('close', () => logStreamService.removeSubscriber(ws));
    ws.on('error', () => logStreamService.removeSubscriber(ws));
  });

  return wss;
}
