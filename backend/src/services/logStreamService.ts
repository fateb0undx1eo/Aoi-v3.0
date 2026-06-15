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

  write(entry: LogEntry): void {
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
}

export const logStreamService = new LogStreamService();
