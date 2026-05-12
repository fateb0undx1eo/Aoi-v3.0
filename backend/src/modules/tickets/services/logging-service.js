/**
 * Logging service for the tickets module
 * Provides structured logging for all ticket operations
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

class LoggingService {
  constructor(level = LOG_LEVELS.INFO) {
    this.level = level;
  }

  /**
   * Logs a debug message
   */
  debug(message, metadata = {}) {
    if (this.level <= LOG_LEVELS.DEBUG) {
      console.log(`[TICKETS:DEBUG] ${message}`, metadata);
    }
  }

  /**
   * Logs an info message
   */
  info(message, metadata = {}) {
    if (this.level <= LOG_LEVELS.INFO) {
      console.log(`[TICKETS:INFO] ${message}`, metadata);
    }
  }

  /**
   * Logs a warning message
   */
  warn(message, metadata = {}) {
    if (this.level <= LOG_LEVELS.WARN) {
      console.warn(`[TICKETS:WARN] ${message}`, metadata);
    }
  }

  /**
   * Logs an error message
   */
  error(message, metadata = {}) {
    if (this.level <= LOG_LEVELS.ERROR) {
      console.error(`[TICKETS:ERROR] ${message}`, metadata);
    }
  }

  /**
   * Sets the logging level
   */
  setLevel(level) {
    this.level = level;
  }

  /**
   * Gets the current logging level
   */
  getLevel() {
    return this.level;
  }
}

// Export singleton instance
const logger = new LoggingService(LOG_LEVELS.INFO);

export default logger;
export { LoggingService, LOG_LEVELS };
