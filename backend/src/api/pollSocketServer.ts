import { WebSocket, WebSocketServer } from 'ws';
import type { Server as HttpServer } from 'node:http';
import type { IncomingMessage } from 'node:http';
import type { Socket } from 'node:net';
import { checkUpgradeRateLimit, recordAuthFailure, isAuthBlocked } from '../core/wsRateLimiter.js';
import { logger } from '../utils/logger.js';

interface PollWebSocket extends WebSocket {
  session: {
    user: { id: string; [key: string]: any };
    guildId: string;
    [key: string]: any;
  };
  pollSubscriptions: Set<string>;
}

interface PollSocketDeps {
  server: HttpServer;
  authService: {
    readSocketTicket(ticket: string): Record<string, any> | null;
  };
  accessControlService: {
    canAccessGuild(guildId: string, userId: string): Promise<boolean>;
  };
  metrics?: {
    increment(name: string, labels?: Record<string, string | number>, value?: number): void;
  } | null;
}

function rejectUpgrade(socket: Socket, statusCode: number = 401, message: string = 'Unauthorized'): void {
  socket.write(`HTTP/1.1 ${statusCode} ${message}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

export interface PollBroadcast {
  pollId: string;
  guildId: string;
  event: 'update' | 'finalized' | 'deleted';
  poll?: Record<string, any> | null;
  totals?: Array<{ option_id: string; count: number; pct: number }>;
}

class PollHub {
  private guildSockets = new Map<string, Set<PollWebSocket>>();

  add(guildId: string, socket: PollWebSocket): void {
    let set = this.guildSockets.get(guildId);
    if (!set) {
      set = new Set();
      this.guildSockets.set(guildId, set);
    }
    set.add(socket);
  }

  remove(socket: PollWebSocket): void {
    for (const [guildId, set] of this.guildSockets) {
      if (set.delete(socket) && set.size === 0) {
        this.guildSockets.delete(guildId);
      }
    }
  }

  broadcast(payload: PollBroadcast): void {
    const set = this.guildSockets.get(payload.guildId);
    if (!set || set.size === 0) return;
    const message = JSON.stringify({ type: 'poll:update', ...payload });
    for (const socket of set) {
      if (
        socket.readyState !== WebSocket.OPEN ||
        (socket.pollSubscriptions.size > 0 && !socket.pollSubscriptions.has(payload.pollId))
      ) {
        continue;
      }
      try {
        socket.send(message);
      } catch (error: any) {
        logger.debug({ error: error?.message }, '[poll-ws] send failed');
      }
    }
  }
}

export const pollHub = new PollHub();

export function broadcastPollEvent(payload: PollBroadcast): void {
  pollHub.broadcast(payload);
}

export function attachPollSocketServer({
  server,
  authService,
  accessControlService,
  metrics = null,
}: PollSocketDeps): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', async (request: IncomingMessage, socket: Socket, head: Buffer): Promise<void> => {
    try {
      const url = new URL(request.url || '/', 'http://localhost');
      if (url.pathname !== '/ws/polls') {
        return;
      }

      if (!checkUpgradeRateLimit(request, socket)) return;

      if (isAuthBlocked(request)) {
        rejectUpgrade(socket, 429, 'Too Many Failed Auth Attempts');
        return;
      }

      const ticket = url.searchParams.get('ticket') || '';
      const session = authService.readSocketTicket(ticket);
      if (!session?.user?.id || !session.guildId) {
        recordAuthFailure(request);
        rejectUpgrade(socket, 401, 'Unauthorized');
        return;
      }

      const allowed = await accessControlService.canAccessGuild(session.guildId, session.user.id);
      if (!allowed) {
        recordAuthFailure(request);
        rejectUpgrade(socket, 403, 'Forbidden');
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws: WebSocket): void => {
        (ws as PollWebSocket).session = session as any;
        (ws as PollWebSocket).pollSubscriptions = new Set();
        wss.emit('connection', ws, request);
      });
    } catch {
      rejectUpgrade(socket, 500, 'Server Error');
    }
  });

  wss.on('connection', (ws: WebSocket): void => {
    const pollWs = ws as PollWebSocket;
    const guildId = pollWs.session.guildId;
    pollHub.add(guildId, pollWs);
    metrics?.increment?.('poll_websocket_connections_total');

    logger.debug({ guildId }, '[poll-ws] client connected');

    ws.on('message', (raw: unknown) => {
      try {
        const message = JSON.parse(String(raw ?? '{}'));
        if (message?.type === 'poll:subscribe' && Array.isArray(message?.pollIds)) {
          pollWs.pollSubscriptions = new Set(
            message.pollIds.map((id: unknown) => String(id)).filter(Boolean)
          );
        } else if (message?.type === 'poll:unsubscribe') {
          pollWs.pollSubscriptions.clear();
        }
      } catch {
        /* ignore malformed frames */
      }
    });

    const cleanup = (): void => {
      pollHub.remove(pollWs);
    };
    ws.on('close', cleanup);
    ws.on('error', cleanup);
  });

  return wss;
}
