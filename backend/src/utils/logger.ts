import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import pino from 'pino';
import type { Logger } from '../types/index.js';
import { logStreamService } from '../services/logStreamService.js';

const contextStorage = new AsyncLocalStorage<Record<string, any>>();

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

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function emit(level: LogLevel, message: any, meta: any = null): void {
  if (typeof message === 'object' && message !== null && typeof meta === 'string') {
    [message, meta] = [meta, message];
  }
  const context = contextStorage.getStore() ?? {};
  const logFn = (baseLogger[level] as Function).bind(baseLogger);
  if (meta) {
    logFn({ ...context, ...(meta instanceof Error ? { err: meta } : meta) }, String(message));
  } else {
    logFn({ ...context }, String(message));
  }

  logStreamService.write({
    level,
    message: String(message),
    timestamp: new Date().toISOString(),
    meta: meta instanceof Error ? { message: meta.message, stack: meta.stack, name: meta.name } : meta || undefined,
    context: Object.keys(context).length > 0 ? context : undefined,
  });
}

export function withLogContext<T>(context: Record<string, any>, fn: () => T): T {
  const parent = contextStorage.getStore() ?? {};
  return contextStorage.run({ ...parent, ...context }, fn);
}

export function getLogContext(): Record<string, any> {
  return contextStorage.getStore() ?? {};
}

export function createRequestId(): string {
  return randomUUID();
}

export const logger: Logger = {
  debug: (message: any, meta?: any): void => emit('debug', message, meta),
  info: (message: any, meta?: any): void => emit('info', message, meta),
  warn: (message: any, meta?: any): void => emit('warn', message, meta),
  error: (message: any, meta?: any): void => emit('error', message, meta),
  child(context: Record<string, any> = {}): Logger {
    return {
      debug: (message: any, meta?: any) => withLogContext(context, () => emit('debug', message, meta)),
      info: (message: any, meta?: any) => withLogContext(context, () => emit('info', message, meta)),
      warn: (message: any, meta?: any) => withLogContext(context, () => emit('warn', message, meta)),
      error: (message: any, meta?: any) => withLogContext(context, () => emit('error', message, meta)),
    } as Logger;
  },
};
