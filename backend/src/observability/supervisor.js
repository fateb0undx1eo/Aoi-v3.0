import { metrics } from './metrics.js';
import { logger } from '../utils/logger.js';

export class RuntimeSupervisor {
  constructor({
    runtimeState,
    redis,
    database,
    discordClient,
    websocketStats,
    intervalMs = 30000
  }) {
    this.runtimeState = runtimeState;
    this.redis = redis;
    this.database = database;
    this.discordClient = discordClient;
    this.websocketStats = websocketStats;
    this.intervalMs = intervalMs;
    this.timer = null;
  }

  async checkRedis() {
    if (!this.redis?.isReady?.()) {
      this.runtimeState.setHealth('redis', 'degraded', { ready: false });
      return;
    }

    await metrics.time('redis_latency_ms', { operation: 'ping' }, async () => {
      const client = this.redis.getClient?.();
      if (client?.ping) await client.ping();
    });
    this.runtimeState.setHealth('redis', 'healthy');
  }

  async checkDatabase() {
    await metrics.time('database_latency_ms', { operation: 'health' }, async () => {
      await this.database.fetchMany('guilds', (table) => table.select('id').limit(1));
    });
    this.runtimeState.setHealth('database', 'healthy');
  }

  checkDiscord() {
    const ready = this.discordClient?.isReady?.() ?? false;
    const ws = this.discordClient?.ws;
    metrics.gauge('discord_guilds', this.discordClient?.guilds?.cache?.size ?? 0);
    metrics.gauge('discord_shards', ws?.shards?.size ?? 0);
    this.runtimeState.setHealth('discord', ready ? 'healthy' : 'degraded', {
      ready,
      status: ws?.status ?? null,
      ping: ws?.ping ?? null
    });
  }

  checkWebsockets() {
    const stats = this.websocketStats?.() ?? {};
    metrics.gauge('websocket_connections', stats.connections ?? 0);
    this.runtimeState.setHealth('websocket', 'healthy', stats);
  }

  async runOnce() {
    const checks = [
      this.checkRedis().catch((error) => {
        this.runtimeState.setHealth('redis', 'degraded', { error: error.message });
      }),
      this.checkDatabase().catch((error) => {
        this.runtimeState.setHealth('database', 'degraded', { error: error.message });
      }),
      Promise.resolve().then(() => this.checkDiscord()),
      Promise.resolve().then(() => this.checkWebsockets())
    ];
    await Promise.allSettled(checks);
  }

  start() {
    if (this.timer) return;
    this.runOnce().catch((error) => logger.warn('Supervisor check failed', error));
    this.timer = setInterval(() => {
      this.runOnce().catch((error) => logger.warn('Supervisor check failed', error));
    }, this.intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
