import { logger } from '../../../utils/logger.js';

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

class LoggingService {
  constructor(level = LOG_LEVELS.INFO) {
    this.level = level;
    this._logger = logger.child({ module: 'tickets' });
  }

  debug(message, metadata = {}) {
    if (this.level <= LOG_LEVELS.DEBUG) {
      this._logger.debug({ ...metadata }, message);
    }
  }

  info(message, metadata = {}) {
    if (this.level <= LOG_LEVELS.INFO) {
      this._logger.info({ ...metadata }, message);
    }
  }

  warn(message, metadata = {}) {
    if (this.level <= LOG_LEVELS.WARN) {
      this._logger.warn({ ...metadata }, message);
    }
  }

  error(message, metadata = {}) {
    if (this.level <= LOG_LEVELS.ERROR) {
      this._logger.error({ ...metadata }, message);
    }
  }

  setLevel(level) {
    this.level = level;
  }

  getLevel() {
    return this.level;
  }
}

const loggerInstance = new LoggingService(LOG_LEVELS.INFO);

export default loggerInstance;
export { LoggingService, LOG_LEVELS };