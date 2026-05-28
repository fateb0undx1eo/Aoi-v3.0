import { WebSocket, WebSocketServer } from 'ws';

function rejectUpgrade(socket, statusCode = 401, message = 'Unauthorized') {
  socket.write(`HTTP/1.1 ${statusCode} ${message}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

export function attachOverviewSocketServer({
  server,
  authService,
  accessControlService,
  dashboardOverviewService,
  metrics = null
}) {
  const wss = new WebSocketServer({ noServer: true });
  const stats = {
    connections: 0,
    total_connections: 0,
    last_connection_at: null
  };

  server.on('upgrade', async (request, socket, head) => {
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

      wss.handleUpgrade(request, socket, head, (ws) => {
        ws.session = session;
        wss.emit('connection', ws, request);
      });
    } catch {
      rejectUpgrade(socket, 500, 'Server Error');
    }
  });

  wss.on('connection', async (ws) => {
    stats.connections += 1;
    stats.total_connections += 1;
    stats.last_connection_at = new Date().toISOString();
    metrics?.increment?.('websocket_connections_total');

    const guildId = ws.session.guildId;

    const sendOverview = async (force = false) => {
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

    const cleanup = () => {
      clearInterval(timer);
      stats.connections = Math.max(0, stats.connections - 1);
    };
    ws.on('close', cleanup);
    ws.on('error', cleanup);
  });

  wss.getStats = () => ({ ...stats });
  return wss;
}
