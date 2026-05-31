import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import pino from 'pino';

const contextStorage = new AsyncLocalStorage();

const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'development' ? 'debug' : 'info');

const transport = pino.transport({
  target: 'pino-pretty',
  options: {
    colorize: true,
    translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
    ignore: 'pid,hostname',
    singleLine: false,
  },
});

const baseLogger = pino(
  {
    level,
    redact: {
      paths: ['token', 'secret', 'password', 'authorization', 'cookie', 'key', 'credential'],
      censor: '[REDACTED]',
    },
  },
  transport,
);

function emit(level, message, meta = null) {
  const context = contextStorage.getStore() ?? {};
  const logFn = baseLogger[level].bind(baseLogger);
  if (meta) {
    logFn({ ...context, ...(meta instanceof Error ? { err: meta } : meta) }, String(message));
  } else {
    logFn({ ...context }, String(message));
  }
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
      error: (message, meta) => withLogContext(context, () => emit('error', message, meta)),
    };
  },
};
