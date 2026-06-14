import { metrics } from './metrics.js';
import { logger } from '../utils/logger.js';
import type { RuntimeState } from './runtimeState.js';
import type { RedisClient } from '../types/index.js';
import type { Logger } from '../types/index.js';

interface SupervisorOptions {
  runtimeState: RuntimeState;
  redis: RedisClient;
  database: typeof import('../database/repository.js');
  discordClient: any;
  websocketStats: () => Record<string, any>;
  intervalMs?: number;
}

export class RuntimeSupervisor {
  private runtimeState: RuntimeState;
  private redis: RedisClient;
  private database: typeof import('../database/repository.js');
  private discordClient: any;
  private websocketStats: () => Record<string, any>;
  private intervalMs: number;
  private timer: ReturnType<typeof setInterval> | null;

  constructor({
    runtimeState,
    redis,
    database,
    discordClient,
    websocketStats,
    intervalMs = 30000
  }: SupervisorOptions) {
    this.runtimeState = runtimeState;
    this.redis = redis;
    this.database = database;
    this.discordClient = discordClient;
    this.websocketStats = websocketStats;
    this.intervalMs = intervalMs;
    this.timer = null;
  }

  private async checkRedis(): Promise<void> {
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

  private async checkDatabase(): Promise<void> {
    await metrics.time('database_latency_ms', { operation: 'health' }, async () => {
      await this.database.fetchMany('guilds', (table: any) => table.select('id').limit(1));
    });
    this.runtimeState.setHealth('database', 'healthy');
  }

  private checkDiscord(): void {
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

  private checkWebsockets(): void {
    const stats = this.websocketStats?.() ?? {};
    metrics.gauge('websocket_connections', stats.connections ?? 0);
    this.runtimeState.setHealth('websocket', 'healthy', stats);
  }

  async runOnce(): Promise<void> {
    const checks = [
      this.checkRedis().catch((error: Error) => {
        this.runtimeState.setHealth('redis', 'degraded', { error: error.message });
      }),
      this.checkDatabase().catch((error: Error) => {
        this.runtimeState.setHealth('database', 'degraded', { error: error.message });
      }),
      Promise.resolve().then(() => this.checkDiscord()),
      Promise.resolve().then(() => this.checkWebsockets())
    ];
    await Promise.allSettled(checks);
  }

  start(): void {
    if (this.timer) return;
    this.runOnce().catch((error: Error) => logger.warn('Supervisor check failed', error));
    this.timer = setInterval(() => {
      this.runOnce().catch((error: Error) => logger.warn('Supervisor check failed', error));
    }, this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
