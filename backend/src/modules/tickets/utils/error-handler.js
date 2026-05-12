/**
 * Structured error handling for the tickets module
 */

import logger from '../services/logging-service.js';

export class TicketError extends Error {
  constructor(message, code = 'TICKET_ERROR', metadata = {}) {
    super(message);
    this.name = 'TicketError';
    this.code = code;
    this.metadata = metadata;
  }
}

export class ValidationError extends TicketError {
  constructor(message, metadata = {}) {
    super(message, 'VALIDATION_ERROR', metadata);
    this.name = 'ValidationError';
  }
}

export class PermissionError extends TicketError {
  constructor(message, metadata = {}) {
    super(message, 'PERMISSION_ERROR', metadata);
    this.name = 'PermissionError';
  }
}

export class NotFoundError extends TicketError {
  constructor(message, metadata = {}) {
    super(message, 'NOT_FOUND', metadata);
    this.name = 'NotFoundError';
  }
}

export class DatabaseError extends TicketError {
  constructor(message, metadata = {}) {
    super(message, 'DATABASE_ERROR', metadata);
    this.name = 'DatabaseError';
  }
}

export class CooldownError extends TicketError {
  constructor(message, readyAt, metadata = {}) {
    super(message, 'COOLDOWN_ERROR', { ...metadata, readyAt });
    this.name = 'CooldownError';
    this.readyAt = readyAt;
  }
}

/**
 * Handles errors and logs them appropriately
 */
export async function handleError(error, interaction = null, context = {}) {
  const errorLog = {
    name: error.name,
    message: error.message,
    code: error.code,
    context,
    metadata: error.metadata,
    stack: error.stack
  };

  if (error instanceof TicketError) {
    logger.error('Ticket error:', errorLog);
  } else {
    logger.error('Unexpected error:', errorLog);
  }

  // If there's an interaction, try to respond to the user
  if (interaction) {
    try {
      const payload = {
        content: error.message || 'An error occurred. Please try again.',
        ephemeral: true
      };

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(payload).catch(() => null);
      } else {
        await interaction.reply(payload).catch(() => null);
      }
    } catch (replyError) {
      logger.error('Failed to reply to interaction:', { error: replyError });
    }
  }

  return error;
}

/**
 * Wraps an async function with error handling
 */
export function withErrorHandling(fn, name = 'Unknown') {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      logger.error(`Error in ${name}:`, {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  };
}

export default {
  TicketError,
  ValidationError,
  PermissionError,
  NotFoundError,
  DatabaseError,
  CooldownError,
  handleError,
  withErrorHandling
};
