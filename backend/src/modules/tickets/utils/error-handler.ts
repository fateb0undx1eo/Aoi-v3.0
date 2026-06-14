import logger from '../services/logging-service.js';

export class TicketError extends Error {
  code: string;
  metadata: Record<string, unknown>;

  constructor(message: string, code: string = 'TICKET_ERROR', metadata: Record<string, unknown> = {}) {
    super(message);
    this.name = 'TicketError';
    this.code = code;
    this.metadata = metadata;
  }
}

export class ValidationError extends TicketError {
  constructor(message: string, metadata: Record<string, unknown> = {}) {
    super(message, 'VALIDATION_ERROR', metadata);
    this.name = 'ValidationError';
  }
}

export class PermissionError extends TicketError {
  constructor(message: string, metadata: Record<string, unknown> = {}) {
    super(message, 'PERMISSION_ERROR', metadata);
    this.name = 'PermissionError';
  }
}

export class NotFoundError extends TicketError {
  constructor(message: string, metadata: Record<string, unknown> = {}) {
    super(message, 'NOT_FOUND', metadata);
    this.name = 'NotFoundError';
  }
}

export class DatabaseError extends TicketError {
  constructor(message: string, metadata: Record<string, unknown> = {}) {
    super(message, 'DATABASE_ERROR', metadata);
    this.name = 'DatabaseError';
  }
}

export class CooldownError extends TicketError {
  readyAt: number;

  constructor(message: string, readyAt: number, metadata: Record<string, unknown> = {}) {
    super(message, 'COOLDOWN_ERROR', { ...metadata, readyAt });
    this.name = 'CooldownError';
    this.readyAt = readyAt;
  }
}

export async function handleError(error: Error, interaction: any = null, context: Record<string, unknown> = {}): Promise<Error> {
  const errorLog = {
    name: error.name,
    message: error.message,
    code: (error as TicketError).code,
    context,
    metadata: (error as TicketError).metadata,
    stack: error.stack
  };

  if (error instanceof TicketError) {
    logger.error('Ticket error:', errorLog);
  } else {
    logger.error('Unexpected error:', errorLog);
  }

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
      logger.error('Failed to reply to interaction:', { error: (replyError as Error).message });
    }
  }

  return error;
}

export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(fn: T, name: string = 'Unknown'): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      logger.error(`Error in ${name}:`, {
        name: (error as Error).name,
        message: (error as Error).message,
        stack: (error as Error).stack
      });
      throw error;
    }
  }) as T;
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
