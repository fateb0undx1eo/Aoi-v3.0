import { WebSocketServer } from 'ws';

function rejectUpgrade(socket, statusCode = 401, message = 'Unauthorized') {
  socket.write(`HTTP/1.1 ${statusCode} ${message}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

export function attachOverviewSocketServer({
  server,
  authService,
  accessControlService,
  dashboardOverviewService
}) {
  const wss = new WebSocketServer({ noServer: true });

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
    const guildId = ws.session.guildId;

    const sendOverview = async (force = false) => {
      const payload = await dashboardOverviewService.getOverview(guildId, { force });
      if (!payload || ws.readyState !== ws.OPEN) {
        return;
      }

      ws.send(JSON.stringify({
        type: 'overview:update',
        payload
      }));
    };

    await sendOverview();

    const timer = setInterval(() => {
      sendOverview(true).catch(() => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: 'overview:error' }));
        }
      });
    }, 30 * 1000);

    ws.on('close', () => clearInterval(timer));
    ws.on('error', () => clearInterval(timer));
  });

  return wss;
}
