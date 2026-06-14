import { logger } from '../../../utils/logger.js';

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
} as const;

type LogLevel = (typeof LOG_LEVELS)[keyof typeof LOG_LEVELS];

class LoggingService {
  private level: LogLevel;
  private _logger: ReturnType<typeof logger.child>;

  constructor(level: LogLevel = LOG_LEVELS.INFO) {
    this.level = level;
    this._logger = logger.child({ module: 'tickets' });
  }

  debug(message: unknown, metadata: Record<string, unknown> = {}): void {
    if (this.level <= LOG_LEVELS.DEBUG) {
      this._logger.debug(message, { ...metadata });
    }
  }

  info(message: unknown, metadata: Record<string, unknown> = {}): void {
    if (this.level <= LOG_LEVELS.INFO) {
      this._logger.info(message, { ...metadata });
    }
  }

  warn(message: unknown, metadata: Record<string, unknown> = {}): void {
    if (this.level <= LOG_LEVELS.WARN) {
      this._logger.warn(message, { ...metadata });
    }
  }

  error(message: unknown, metadata: Record<string, unknown> = {}): void {
    if (this.level <= LOG_LEVELS.ERROR) {
      this._logger.error(message, { ...metadata });
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }
}

const loggerInstance = new LoggingService(LOG_LEVELS.INFO);

export default loggerInstance;
export { LoggingService, LOG_LEVELS };
