import { redisClient } from '../../../core/redis.js';

/**
 * Structured logger for ticket system operations
 * Provides leveled logging with structured output and operational metrics
 */
export class TicketLogger {
  constructor() {
    this.logLevels = {
      ERROR: 0,
      WARN: 1,
      INFO: 2,
      DEBUG: 3
    };
    
    this.currentLevel = this.logLevels.INFO;
    this.sanitizedFields = ['token', 'password', 'secret', 'key', 'credential'];
  }

  /**
   * Set log level
   */
  setLevel(level) {
    this.currentLevel = this.logLevels[level] || this.logLevels.INFO;
  }

  /**
   * Check if log level should be output
   */
  shouldLog(level) {
    return this.logLevels[level] <= this.currentLevel;
  }

  /**
   * Sanitize sensitive data from logs
   */
  sanitize(data) {
    if (!data || typeof data !== 'object') return data;
    
    const sanitized = Array.isArray(data) ? [] : {};
    
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      
      if (this.sanitizedFields.some(field => lowerKey.includes(field))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitize(value);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  /**
   * Create structured log entry
   */
  createLogEntry(level, message, metadata = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      service: 'ticket-system',
      message,
      metadata: this.sanitize(metadata)
    };

    // Add error details if present
    if (metadata.error instanceof Error) {
      entry.metadata.error = {
        name: metadata.error.name,
        message: metadata.error.message,
        stack: metadata.error.stack
      };
    }

    return entry;
  }

  /**
   * Log error
   */
  error(message, metadata = {}) {
    if (!this.shouldLog('ERROR')) return;
    
    const entry = this.createLogEntry('ERROR', message, metadata);
    console.error(JSON.stringify(entry));
    this.storeLog(entry);
  }

  /**
   * Log warning
   */
  warn(message, metadata = {}) {
    if (!this.shouldLog('WARN')) return;
    
    const entry = this.createLogEntry('WARN', message, metadata);
    console.warn(JSON.stringify(entry));
    this.storeLog(entry);
  }

  /**
   * Log info
   */
  info(message, metadata = {}) {
    if (!this.shouldLog('INFO')) return;
    
    const entry = this.createLogEntry('INFO', message, metadata);
    console.log(JSON.stringify(entry));
    this.storeLog(entry);
  }

  /**
   * Log debug
   */
  debug(message, metadata = {}) {
    if (!this.shouldLog('DEBUG')) return;
    
    const entry = this.createLogEntry('DEBUG', message, metadata);
    console.debug(JSON.stringify(entry));
    this.storeLog(entry);
  }

  /**
   * Store log entry in Redis for monitoring
   */
  async storeLog(entry) {
    try {
      const key = `ticket:logs:${entry.level.toLowerCase()}`;
      await redisClient.setWithTTL(key, JSON.stringify(entry), 60 * 60 * 1000); // 1 hour
    } catch (error) {
      // Don't let logging errors break the application
      console.warn('Failed to store log entry:', error);
    }
  }

  /**
   * Log ticket operation with metrics
   */
  logTicketOperation(operation, ticketId, metadata = {}) {
    this.info(`Ticket operation: ${operation}`, {
      operation,
      ticketId,
      ...metadata
    });

    // Store operation metrics
    this.storeOperationMetrics(operation, {
      ticketId,
      timestamp: new Date().toISOString(),
      ...metadata
    });
  }

  /**
   * Log Discord API operation
   */
  logDiscordOperation(operation, metadata = {}) {
    this.info(`Discord API operation: ${operation}`, {
      operation,
      service: 'discord-api',
      ...metadata
    });
  }

  /**
   * Log database operation
   */
  logDatabaseOperation(operation, metadata = {}) {
    this.debug(`Database operation: ${operation}`, {
      operation,
      service: 'database',
      ...metadata
    });
  }

  /**
   * Log Redis operation
   */
  logRedisOperation(operation, metadata = {}) {
    this.debug(`Redis operation: ${operation}`, {
      operation,
      service: 'redis',
      ...metadata
    });
  }

  /**
   * Store operation metrics
   */
  async storeOperationMetrics(operation, metrics) {
    try {
      const key = `ticket:metrics:${operation}`;
      const existing = await redisClient.get(key);
      const data = existing ? JSON.parse(existing) : [];
      
      data.push(metrics);
      
      // Keep only last 100 operations per type
      if (data.length > 100) {
        data.splice(0, data.length - 100);
      }
      
      await redisClient.setWithTTL(key, JSON.stringify(data), 24 * 60 * 60 * 1000); // 24 hours
    } catch (error) {
      console.warn('Failed to store operation metrics:', error);
    }
  }

  /**
   * Get recent logs by level
   */
  async getRecentLogs(level = 'INFO', limit = 50) {
    try {
      const key = `ticket:logs:${level.toLowerCase()}`;
      const logs = await redisClient.get(key);
      return logs ? JSON.parse(logs) : [];
    } catch (error) {
      console.error('Failed to get recent logs:', error);
      return [];
    }
  }

  /**
   * Get operation metrics
   */
  async getOperationMetrics(operation) {
    try {
      const key = `ticket:metrics:${operation}`;
      const metrics = await redisClient.get(key);
      return metrics ? JSON.parse(metrics) : [];
    } catch (error) {
      console.error('Failed to get operation metrics:', error);
      return [];
    }
  }

  /**
   * Create performance timer
   */
  createTimer(operation) {
    const startTime = Date.now();
    
    return {
      end: (metadata = {}) => {
        const duration = Date.now() - startTime;
        this.info(`Operation completed: ${operation}`, {
          operation,
          duration,
          ...metadata
        });
        
        return duration;
      }
    };
  }

  /**
   * Log performance metrics
   */
  logPerformance(operation, duration, metadata = {}) {
    this.info(`Performance: ${operation}`, {
      operation,
      duration,
      performance: true,
      ...metadata
    });
  }
}

// Create singleton logger instance
export const logger = new TicketLogger();

// Set log level based on environment
const envLogLevel = process.env.TICKET_LOG_LEVEL || 'INFO';
logger.setLevel(envLogLevel);

// Export convenience functions
export const logError = (message, metadata) => logger.error(message, metadata);
export const logWarn = (message, metadata) => logger.warn(message, metadata);
export const logInfo = (message, metadata) => logger.info(message, metadata);
export const logDebug = (message, metadata) => logger.debug(message, metadata);

export const logTicketOperation = (operation, ticketId, metadata) => 
  logger.logTicketOperation(operation, ticketId, metadata);

export const logDiscordOperation = (operation, metadata) => 
  logger.logDiscordOperation(operation, metadata);

export const logDatabaseOperation = (operation, metadata) => 
  logger.logDatabaseOperation(operation, metadata);

export const logRedisOperation = (operation, metadata) => 
  logger.logRedisOperation(operation, metadata);

export const createTimer = (operation) => logger.createTimer(operation);
export const logPerformance = (operation, duration, metadata) => 
  logger.logPerformance(operation, duration, metadata);
