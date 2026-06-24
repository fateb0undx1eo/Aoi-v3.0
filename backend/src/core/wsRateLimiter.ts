import type { IncomingMessage } from 'node:http';
import type { Socket } from 'node:net';
import { metrics } from '../observability/metrics.js';

interface WindowEntry {
  count: number;
  resetAt: number;
}

const UPGRADE_LIMIT = 20;
const UPGRADE_WINDOW_MS = 30_000;
const AUTH_FAIL_LIMIT = 10;
const AUTH_FAIL_WINDOW_MS = 60_000;

const upgradeStore = new Map<string, WindowEntry>();
const authFailStore = new Map<string, WindowEntry>();

function checkWindow(store: Map<string, WindowEntry>, key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  let entry = store.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    store.set(key, entry);
  }
  entry.count++;
  return entry.count <= limit;
}

function pruneStore(store: Map<string, WindowEntry>): void {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}

setInterval(() => pruneStore(upgradeStore), 60_000).unref();
setInterval(() => pruneStore(authFailStore), 60_000).unref();

export function getClientIp(request: IncomingMessage): string {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]!.trim();
  }
  const remote = request.socket?.remoteAddress;
  return remote ?? 'unknown';
}

export function checkUpgradeRateLimit(request: IncomingMessage, socket: Socket): boolean {
  const ip = getClientIp(request);

  if (!checkWindow(upgradeStore, ip, UPGRADE_LIMIT, UPGRADE_WINDOW_MS)) {
    metrics.increment('websocket_upgrade_denied_total', { reason: 'rate_limit' });
    socket.write('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return false;
  }

  metrics.increment('websocket_upgrade_attempts_total');
  return true;
}

export function recordAuthFailure(request: IncomingMessage): void {
  const ip = getClientIp(request);
  metrics.increment('websocket_auth_failures_total');
  checkWindow(authFailStore, ip, AUTH_FAIL_LIMIT, AUTH_FAIL_WINDOW_MS);
}

export function isAuthBlocked(request: IncomingMessage): boolean {
  const ip = getClientIp(request);
  const entry = authFailStore.get(ip);
  if (!entry) return false;
  return entry.count > AUTH_FAIL_LIMIT && Date.now() <= entry.resetAt;
}
