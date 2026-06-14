import { WebSocket } from 'ws';
import type { RedisClient } from '../types/index.js';

const REDIS_KEY = 'log:ringbuffer';

export interface LogEntry {
  level: string;
  message: string;
  timestamp: string;
  meta?: Record<string, any>;
  context?: Record<string, any>;
}

export class LogStreamService {
  private redis: RedisClient | null = null;
  private subscribers = new Set<WebSocket>();
  private readonly maxLogs = 5000;

  init(redis: RedisClient): void {
    this.redis = redis;
  }

  write(entry: LogEntry): void {
    const json = JSON.stringify(entry);

    if (this.redis?.isReady()) {
      this.redis.lPush(REDIS_KEY, json).catch(() => {});
      this.redis.lTrim(REDIS_KEY, 0, this.maxLogs - 1).catch(() => {});
    }

    const message = JSON.stringify({ type: 'log', entry });
    for (const ws of this.subscribers) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }
  }

  addSubscriber(ws: WebSocket): void {
    this.subscribers.add(ws);
    ws.on('close', () => this.subscribers.delete(ws));
    ws.on('error', () => this.subscribers.delete(ws));
  }

  removeSubscriber(ws: WebSocket): void {
    this.subscribers.delete(ws);
  }

  async getBacklog(): Promise<LogEntry[]> {
    if (!this.redis?.isReady()) return [];
    try {
      const entries = await this.redis.lRange(REDIS_KEY, 0, this.maxLogs - 1);
      const parsed = entries
        .map((e) => { try { return JSON.parse(e) as LogEntry; } catch { return null; } })
        .filter(Boolean) as LogEntry[];
      return parsed.reverse();
    } catch {
      return [];
    }
  }
}

export const logStreamService = new LogStreamService();
