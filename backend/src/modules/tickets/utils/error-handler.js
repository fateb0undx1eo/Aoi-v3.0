import { loggingService } from '../services/logging-service.js';
import { metricsService } from '../services/metrics-service.js';

/**
 * Enterprise-grade error handler for ticket system
 * Provides structured error handling with correlation IDs and context
 */

export class ErrorHandler {
  /**
   * Handle interaction error with structured logging
   * @param {Object} context - Interaction context
   * @param {Error} error - Error object
   * @param {string} operation - Operation name
   * @param {Object} metadata - Additional metadata
   */
  async handleInteractionError(context, error, operation, metadata = {}) {
    const errorId = this.generateErrorId();
    const errorData = {
      errorId,
      operation,
      guildId: context.guildId,
      threadId: context.threadId,
      userId: context.userId,
      interactionId: context.interactionId,
      requestId: context.requestId,
      message: error.message,
      stack: error.stack,
      metadata,
      timestamp: new Date().toISOString()
    };

    // Log structured error
    await loggingService.error(errorData);

    // Track error metric
    await metricsService.recordMetric(operation, 0, false, {
      guildId: context.guildId,
      threadId: context.threadId,
      userId: context.userId,
      error: error.message
    });

    // Send safe user response if interaction is available
    if (context.interaction && !context.interaction.replied) {
      await this.sendSafeErrorResponse(context.interaction, errorId);
    }

    return errorId;
  }

  /**
   * Handle service error
   * @param {Error} error - Error object
   * @param {string} service - Service name
   * @param {string} operation - Operation name
   * @param {Object} context - Context information
   */
  async handleServiceError(error, service, operation, context = {}) {
    const errorId = this.generateErrorId();
    
    await loggingService.error({
      errorId,
      service,
      operation,
      guildId: context.guildId,
      threadId: context.threadId,
      userId: context.userId,
      message: error.message,
      stack: error.stack,
      metadata: context.metadata,
      timestamp: new Date().toISOString()
    });

    await metricsService.recordMetric(`${service}_${operation}`, 0, false, {
      guildId: context.guildId,
      threadId: context.threadId,
      userId: context.userId,
      error: error.message
    });

    return errorId;
  }

  /**
   * Handle database error
   * @param {Error} error - Error object
   * @param {string} operation - Database operation
   * @param {Object} context - Context information
   */
  async handleDatabaseError(error, operation, context = {}) {
    const errorId = this.generateErrorId();
    
    await loggingService.error({
      errorId,
      service: 'database',
      operation,
      guildId: context.guildId,
      threadId: context.threadId,
      userId: context.userId,
      message: error.message,
      stack: error.stack,
      metadata: {
        query: context.query,
        table: context.table,
        ...context.metadata
      },
      timestamp: new Date().toISOString()
    });

    await metricsService.recordMetric('database_error', 0, false, {
      guildId: context.guildId,
      threadId: context.threadId,
      userId: context.userId,
      error: error.message
    });

    return errorId;
  }

  /**
   * Handle Redis error
   * @param {Error} error - Error object
   * @param {string} operation - Redis operation
   * @param {Object} context - Context information
   */
  async handleRedisError(error, operation, context = {}) {
    const errorId = this.generateErrorId();
    
    await loggingService.error({
      errorId,
      service: 'redis',
      operation,
      guildId: context.guildId,
      threadId: context.threadId,
      userId: context.userId,
      message: error.message,
      stack: error.stack,
      metadata: {
        key: context.key,
        ...context.metadata
      },
      timestamp: new Date().toISOString()
    });

    await metricsService.recordMetric('redis_error', 0, false, {
      guildId: context.guildId,
      threadId: context.threadId,
      userId: context.userId,
      error: error.message
    });

    return errorId;
  }

  /**
   * Wrap async function with error handling
   * @param {Function} fn - Async function to wrap
   * @param {Object} context - Error context
   * @param {string} operation - Operation name
   * @returns {Function} Wrapped function
   */
  wrapAsync(fn, context, operation) {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        await this.handleInteractionError(context, error, operation, {
          arguments: args
        });
        throw error;
      }
    };
  }

  /**
   * Create error boundary for interaction handlers
   * @param {Function} handler - Interaction handler function
   * @param {string} operation - Operation name
   * @returns {Function} Wrapped handler
   */
  createInteractionBoundary(handler, operation) {
    return async (interaction) => {
      const context = {
        guildId: interaction.guildId,
        userId: interaction.user.id,
        interactionId: interaction.id,
        interaction
      };

      try {
        const result = await handler(interaction);
        
        // Log successful completion
        await loggingService.info({
          operation,
          ...context,
          message: `Interaction completed successfully: ${operation}`
        });

        return result;
      } catch (error) {
        await this.handleInteractionError(context, error, operation);
        
        // Don't re-throw to prevent bot crash
        return null;
      }
    };
  }

  /**
   * Send safe error response to user
   * @param {Object} interaction - Discord interaction
   * @param {string} errorId - Error ID for tracking
   */
  async sendSafeErrorResponse(interaction, errorId) {
    try {
      const response = {
        content: '❌ An error occurred while processing your request. Please try again later.',
        ephemeral: true
      };

      if (interaction.isDeferred()) {
        await interaction.editReply(response);
      } else {
        await interaction.reply(response);
      }
    } catch (replyError) {
      // If we can't even reply, just log it
      console.error('Failed to send error response:', replyError);
    }
  }

  /**
   * Generate unique error ID
   * @returns {string} Error ID
   */
  generateErrorId() {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Classify error type
   * @param {Error} error - Error object
   * @returns {string} Error type
   */
  classifyError(error) {
    if (error.name === 'DiscordAPIError') return 'discord_api';
    if (error.name === 'ValidationError') return 'validation';
    if (error.message?.includes('timeout')) return 'timeout';
    if (error.message?.includes('permission')) return 'permission';
    if (error.message?.includes('rate limit')) return 'rate_limit';
    if (error.message?.includes('database') || error.code?.startsWith('23')) return 'database';
    if (error.message?.includes('redis')) return 'redis';
    return 'unknown';
  }

  /**
   * Check if error is retryable
   * @param {Error} error - Error object
   * @returns {boolean} True if error is retryable
   */
  isRetryableError(error) {
    const retryableTypes = ['timeout', 'rate_limit', 'discord_api', 'redis'];
    const errorType = this.classifyError(error);
    return retryableTypes.includes(errorType);
  }

  /**
   * Get retry delay for error
   * @param {Error} error - Error object
   * @param {number} attempt - Current attempt number
   * @returns {number} Retry delay in milliseconds
   */
  getRetryDelay(error, attempt = 1) {
    const errorType = this.classifyError(error);
    const baseDelays = {
      timeout: 1000,
      rate_limit: 5000,
      discord_api: 2000,
      redis: 1000,
      database: 5000,
      validation: 0,
      permission: 0,
      unknown: 3000
    };

    const baseDelay = baseDelays[errorType] || baseDelays.unknown;
    return Math.min(baseDelay * Math.pow(2, attempt - 1), 30000); // Exponential backoff with max 30s
  }

  /**
   * Retry function with error handling
   * @param {Function} fn - Function to retry
   * @param {Object} context - Error context
   * @param {string} operation - Operation name
   * @param {number} maxAttempts - Maximum retry attempts
   * @returns {Promise<*>} Function result
   */
  async retry(fn, context, operation, maxAttempts = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxAttempts || !this.isRetryableError(error)) {
          // Final attempt or non-retryable error
          await this.handleInteractionError(context, error, operation, {
            attempt,
            maxAttempts,
            retryable: this.isRetryableError(error)
          });
          throw error;
        }

        // Log retry attempt
        await loggingService.warn({
          operation,
          ...context,
          message: `Retrying operation after error (attempt ${attempt}/${maxAttempts})`,
          metadata: {
            error: error.message,
            errorType: this.classifyError(error),
            retryDelay: this.getRetryDelay(error, attempt)
          }
        });

        // Wait before retry
        const delay = this.getRetryDelay(error, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  /**
   * Create timeout wrapper for functions
   * @param {Function} fn - Function to wrap
   * @param {number} timeoutMs - Timeout in milliseconds
   * @param {string} operation - Operation name
   * @returns {Function} Wrapped function
   */
  withTimeout(fn, timeoutMs, operation) {
    return async (...args) => {
      return Promise.race([
        fn(...args),
        new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Operation timeout: ${operation} (${timeoutMs}ms)`));
          }, timeoutMs);
        })
      ]);
    };
  }

  /**
   * Create circuit breaker for unreliable operations
   * @param {Function} fn - Function to protect
   * @param {Object} options - Circuit breaker options
   * @returns {Function} Protected function
   */
  createCircuitBreaker(fn, options = {}) {
    const {
      failureThreshold = 5,
      resetTimeout = 60000, // 1 minute
      monitoringPeriod = 10000 // 10 seconds
    } = options;

    let state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    let failures = 0;
    let lastFailureTime = 0;
    let successCount = 0;

    return async (...args) => {
      const now = Date.now();

      // Check if we should reset circuit
      if (state === 'OPEN' && now - lastFailureTime > resetTimeout) {
        state = 'HALF_OPEN';
        successCount = 0;
      }

      // Reject if circuit is open
      if (state === 'OPEN') {
        throw new Error('Circuit breaker is OPEN');
      }

      try {
        const result = await fn(...args);
        
        // Success - reset failure count
        if (state === 'HALF_OPEN') {
          successCount++;
          if (successCount >= 3) { // Need 3 successes to close
            state = 'CLOSED';
            failures = 0;
          }
        } else {
          failures = 0;
        }

        return result;
      } catch (error) {
        failures++;
        lastFailureTime = now;

        // Open circuit if threshold reached
        if (failures >= failureThreshold) {
          state = 'OPEN';
        }

        throw error;
      }
    };
  }
}

// Export singleton instance
export const errorHandler = new ErrorHandler();
