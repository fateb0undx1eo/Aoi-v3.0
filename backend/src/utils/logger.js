import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

const contextStorage = new AsyncLocalStorage();
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const configuredLevel = String(process.env.LOG_LEVEL || (process.env.NODE_ENV === 'development' ? 'debug' : 'info')).toLowerCase();
const minimumLevel = LEVELS[configuredLevel] ?? LEVELS.info;
const SECRET_KEYS = /token|secret|password|authorization|cookie|key|credential/i;

function redact(value, depth = 0) {
  if (depth > 6) return '[MaxDepth]';
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
      code: value.code
    };
  }
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (!value || typeof value !== 'object') return value;

  const output = {};
  for (const [key, item] of Object.entries(value)) {
    output[key] = SECRET_KEYS.test(key) ? '[REDACTED]' : redact(item, depth + 1);
  }
  return output;
}

function normalizeMeta(meta) {
  if (!meta) return {};
  if (meta instanceof Error) return { error: redact(meta) };
  if (typeof meta === 'object') return redact(meta);
  return { value: meta };
}

function emit(level, message, meta = null) {
  if ((LEVELS[level] ?? LEVELS.info) < minimumLevel) return;
  const context = contextStorage.getStore() ?? {};
  const entry = {
    ts: new Date().toISOString(),
    level,
    message: String(message),
    pid: process.pid,
    ...context,
    ...normalizeMeta(meta)
  };
  console.log(JSON.stringify(entry));
}

export function withLogContext(context, fn) {
  const parent = contextStorage.getStore() ?? {};
  return contextStorage.run({ ...parent, ...context }, fn);
}

export function getLogContext() {
  return contextStorage.getStore() ?? {};
}

export function createRequestId() {
  return randomUUID();
}

export const logger = {
  debug: (message, meta) => emit('debug', message, meta),
  info: (message, meta) => emit('info', message, meta),
  warn: (message, meta) => emit('warn', message, meta),
  error: (message, meta) => emit('error', message, meta),
  child(context = {}) {
    return {
      debug: (message, meta) => withLogContext(context, () => emit('debug', message, meta)),
      info: (message, meta) => withLogContext(context, () => emit('info', message, meta)),
      warn: (message, meta) => withLogContext(context, () => emit('warn', message, meta)),
      error: (message, meta) => withLogContext(context, () => emit('error', message, meta))
    };
  }
};
