import { WebSocket } from 'ws';

export interface LogEntry {
  level: string;
  message: string;
  timestamp: string;
  meta?: Record<string, any>;
  context?: Record<string, any>;
}

export class LogStreamService {
  private subscribers = new Set<WebSocket>();
  private buffer: LogEntry[] = [];
  private readonly maxBufferSize = 1000;

  write(entry: LogEntry): void {
    // Keep in-memory ring buffer (resets on bot restart)
    this.buffer.push(entry);
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
    }

    const message = JSON.stringify({ type: 'log', entry });
    for (const ws of this.subscribers) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }
  }

  addSubscriber(ws: WebSocket): void {
    // Send backlog on connect (survives page refresh, resets on bot restart)
    if (this.buffer.length > 0 && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'backlog', entries: this.buffer }));
    }

    this.subscribers.add(ws);
    ws.on('close', () => this.subscribers.delete(ws));
    ws.on('error', () => this.subscribers.delete(ws));
  }

  removeSubscriber(ws: WebSocket): void {
    this.subscribers.delete(ws);
  }
}

export const logStreamService = new LogStreamService();
