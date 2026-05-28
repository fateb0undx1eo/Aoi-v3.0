import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { WebSocket } from 'ws';
import { buildApiServer } from '../src/api/server.js';
import { attachOverviewSocketServer } from '../src/api/overviewSocketServer.js';

function listen(server) {
  return new Promise((resolve) => server.listen(0, () => resolve(server.address().port)));
}

function requestJson(port, path) {
  return new Promise((resolve, reject) => {
    http.get({ port, path }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
    }).on('error', reject);
  });
}

test('healthz and metrics expose runtime diagnostics', async () => {
  const app = buildApiServer({
    env: { nodeEnv: 'test', frontend: { corsAllowedOrigins: [] } },
    discordClient: { isReady: () => true },
    redis: { isReady: () => false },
    authService: {},
    guildService: {},
    accessControlService: {},
    dashboardOverviewService: {},
    moduleService: {},
    analyticsService: {},
    websocketStats: () => ({ connections: 0 }),
    queueStats: () => []
  });
  const server = http.createServer(app);
  const port = await listen(server);

  const health = await requestJson(port, '/healthz');
  assert.equal(health.status, 200);
  assert.equal(health.body.discord_ready, true);
  assert.equal(health.body.redis_ready, false);

  const metrics = await requestJson(port, '/metrics');
  assert.equal(metrics.status, 200);
  assert.ok(metrics.body.memory);
  assert.ok(metrics.body.runtime);

  server.close();
});

test('overview websocket authenticates ticket and tracks connection stats', async () => {
  const server = http.createServer((_req, res) => res.end('ok'));
  const wss = attachOverviewSocketServer({
    server,
    authService: {
      readSocketTicket(ticket) {
        return ticket === 'valid'
          ? { user: { id: '123456789012345678' }, guildId: '223456789012345678' }
          : null;
      }
    },
    accessControlService: {
      async canAccessGuild() { return true; }
    },
    dashboardOverviewService: {
      async getOverview() { return { ok: true }; }
    }
  });
  const port = await listen(server);

  await new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/dashboard-overview?ticket=valid`);
    ws.on('message', (raw) => {
      const payload = JSON.parse(raw.toString());
      assert.equal(payload.type, 'overview:update');
      assert.equal(wss.getStats().connections, 1);
      ws.close();
    });
    ws.on('close', resolve);
    ws.on('error', reject);
  });

  wss.close();
  server.close();
});
