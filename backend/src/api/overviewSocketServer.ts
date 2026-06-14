import { WebSocket, WebSocketServer } from 'ws';
import type { Server as HttpServer } from 'node:http';
import type { IncomingMessage } from 'node:http';
import type { Socket } from 'node:net';

interface OverviewWebSocket extends WebSocket {
  session: {
    user: { id: string; [key: string]: any };
    guildId: string;
    [key: string]: any;
  };
}

interface OverviewWebSocketServer extends WebSocketServer {
  getStats(): { connections: number; total_connections: number; last_connection_at: string | null };
}

interface OverviewSocketDeps {
  server: HttpServer;
  authService: {
    readSocketTicket(ticket: string): Record<string, any> | null;
  };
  accessControlService: {
    canAccessGuild(guildId: string, userId: string): Promise<boolean>;
  };
  dashboardOverviewService: {
    getOverview(guildId: string, opts?: { force?: boolean }): Promise<Record<string, any> | null>;
  };
  metrics?: {
    increment(name: string, labels?: Record<string, string | number>, value?: number): void;
  } | null;
}

function rejectUpgrade(socket: Socket, statusCode: number = 401, message: string = 'Unauthorized'): void {
  socket.write(`HTTP/1.1 ${statusCode} ${message}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

export function attachOverviewSocketServer({
  server,
  authService,
  accessControlService,
  dashboardOverviewService,
  metrics = null
}: OverviewSocketDeps): OverviewWebSocketServer {
  const wss = new WebSocketServer({ noServer: true }) as OverviewWebSocketServer;
  const stats = {
    connections: 0,
    total_connections: 0,
    last_connection_at: null as string | null
  };

  server.on('upgrade', async (request: IncomingMessage, socket: Socket, head: Buffer): Promise<void> => {
    try {
      const url = new URL(request.url || '/', 'http://localhost');
      if (url.pathname !== '/ws/dashboard-overview') {
        return;
      }

      const ticket = url.searchParams.get('ticket') || '';
      const session = authService.readSocketTicket(ticket);
      if (!session?.user?.id || !session.guildId) {
        rejectUpgrade(socket, 401, 'Unauthorized');
        return;
      }

      const allowed = await accessControlService.canAccessGuild(session.guildId, session.user.id);
      if (!allowed) {
        rejectUpgrade(socket, 403, 'Forbidden');
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws: WebSocket): void => {
        (ws as OverviewWebSocket).session = session as any;
        wss.emit('connection', ws, request);
      });
    } catch {
      rejectUpgrade(socket, 500, 'Server Error');
    }
  });

  wss.on('connection', async (ws: WebSocket): Promise<void> => {
    stats.connections += 1;
    stats.total_connections += 1;
    stats.last_connection_at = new Date().toISOString();
    metrics?.increment?.('websocket_connections_total');

    const overviewWs = ws as OverviewWebSocket;
    const guildId = overviewWs.session.guildId;

    const sendOverview = async (force: boolean = false): Promise<void> => {
      const payload = await dashboardOverviewService.getOverview(guildId, { force });
      if (!payload || ws.readyState !== WebSocket.OPEN) {
        return;
      }

      ws.send(JSON.stringify({
        type: 'overview:update',
        payload
      }));
    };

    await sendOverview().catch(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'overview:error' }));
      }
    });

    const timer = setInterval(() => {
      sendOverview(true).catch(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'overview:error' }));
        }
      });
    }, 30 * 1000);

    const cleanup = (): void => {
      clearInterval(timer);
      stats.connections = Math.max(0, stats.connections - 1);
    };
    ws.on('close', cleanup);
    ws.on('error', cleanup);
  });

  wss.getStats = () => ({ ...stats });
  return wss;
}
