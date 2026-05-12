/**
 * Data repository for ticket operations
 * Handles all database interactions for tickets
 */

import logger from '../services/logging-service.js';
import { DatabaseError, ValidationError } from '../utils/error-handler.js';
import { isValidDiscordId, isValidThreadId } from '../utils/validators.js';

export class TicketRepository {
  constructor(database) {
    this.db = database;
  }

  /**
   * Creates a new ticket record in the database
   */
  async createTicket(data) {
    const { guildId, threadId, creatorId, tagValue, createdAt = new Date() } = data;

    if (!isValidDiscordId(guildId)) {
      throw new ValidationError('Invalid guild ID');
    }
    if (!isValidThreadId(threadId)) {
      throw new ValidationError('Invalid thread ID');
    }
    if (!isValidDiscordId(creatorId)) {
      throw new ValidationError('Invalid creator ID');
    }

    try {
      const result = await this.db.query(
        `INSERT INTO tickets (guild_id, thread_id, creator_id, tag_value, created_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [guildId, threadId, creatorId, tagValue, createdAt]
      );

      logger.info('Ticket created', { threadId, creatorId });
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to create ticket', { threadId, error: error.message });
      throw new DatabaseError('Failed to create ticket', { threadId });
    }
  }

  /**
   * Gets a ticket by thread ID
   */
  async getTicketByThreadId(threadId) {
    if (!isValidThreadId(threadId)) {
      throw new ValidationError('Invalid thread ID');
    }

    try {
      const result = await this.db.query(
        'SELECT * FROM tickets WHERE thread_id = $1',
        [threadId]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to fetch ticket', { threadId, error: error.message });
      throw new DatabaseError('Failed to fetch ticket', { threadId });
    }
  }

  /**
   * Gets all active tickets for a user in a guild
   */
  async getActiveTicketsForUser(guildId, creatorId, channelId = null) {
    if (!isValidDiscordId(guildId)) {
      throw new ValidationError('Invalid guild ID');
    }
    if (!isValidDiscordId(creatorId)) {
      throw new ValidationError('Invalid creator ID');
    }

    try {
      let query = `
        SELECT * FROM tickets 
        WHERE guild_id = $1 AND creator_id = $2 AND resolved_at IS NULL
      `;
      const params = [guildId, creatorId];

      if (channelId) {
        query += ' AND channel_id = $3';
        params.push(channelId);
      }

      const result = await this.db.query(query + ' ORDER BY created_at DESC', params);
      return result.rows;
    } catch (error) {
      logger.error('Failed to fetch active tickets', { guildId, creatorId, error: error.message });
      throw new DatabaseError('Failed to fetch active tickets');
    }
  }

  /**
   * Resolves a ticket (marks it as closed)
   */
  async resolveTicket(threadId, resolverId, resolvedAt = new Date()) {
    if (!isValidThreadId(threadId)) {
      throw new ValidationError('Invalid thread ID');
    }
    if (!isValidDiscordId(resolverId)) {
      throw new ValidationError('Invalid resolver ID');
    }

    try {
      const result = await this.db.query(
        `UPDATE tickets 
         SET resolved_at = $1, resolved_by = $2
         WHERE thread_id = $3
         RETURNING *`,
        [resolvedAt, resolverId, threadId]
      );

      if (result.rows.length === 0) {
        throw new DatabaseError('Ticket not found', { threadId });
      }

      logger.info('Ticket resolved', { threadId, resolverId });
      return result.rows[0];
    } catch (error) {
      if (error instanceof DatabaseError) throw error;
      logger.error('Failed to resolve ticket', { threadId, error: error.message });
      throw new DatabaseError('Failed to resolve ticket', { threadId });
    }
  }

  /**
   * Gets ticket stats for a guild
   */
  async getTicketStats(guildId) {
    if (!isValidDiscordId(guildId)) {
      throw new ValidationError('Invalid guild ID');
    }

    try {
      const result = await this.db.query(
        `SELECT 
           COUNT(*) as total,
           COUNT(CASE WHEN resolved_at IS NULL THEN 1 END) as active,
           COUNT(CASE WHEN resolved_at IS NOT NULL THEN 1 END) as resolved
         FROM tickets 
         WHERE guild_id = $1`,
        [guildId]
      );

      const row = result.rows[0];
      return {
        total: parseInt(row.total, 10),
        active: parseInt(row.active, 10),
        resolved: parseInt(row.resolved, 10)
      };
    } catch (error) {
      logger.error('Failed to fetch ticket stats', { guildId, error: error.message });
      throw new DatabaseError('Failed to fetch ticket stats', { guildId });
    }
  }

  /**
   * Records a user action on a ticket (add/remove user)
   */
  async recordUserAction(data) {
    const { threadId, actionType, targetUserId, performedBy, performedAt = new Date() } = data;

    if (!isValidThreadId(threadId)) {
      throw new ValidationError('Invalid thread ID');
    }

    try {
      const result = await this.db.query(
        `INSERT INTO ticket_user_actions (thread_id, action_type, target_user_id, performed_by, performed_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [threadId, actionType, targetUserId, performedBy, performedAt]
      );

      logger.info('Ticket user action recorded', { threadId, actionType, targetUserId });
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to record user action', { threadId, error: error.message });
      throw new DatabaseError('Failed to record user action', { threadId });
    }
  }

  /**
   * Gets action history for a ticket
   */
  async getTicketActionHistory(threadId, limit = 50) {
    if (!isValidThreadId(threadId)) {
      throw new ValidationError('Invalid thread ID');
    }

    try {
      const result = await this.db.query(
        `SELECT * FROM ticket_user_actions 
         WHERE thread_id = $1
         ORDER BY performed_at DESC
         LIMIT $2`,
        [threadId, limit]
      );

      return result.rows;
    } catch (error) {
      logger.error('Failed to fetch action history', { threadId, error: error.message });
      throw new DatabaseError('Failed to fetch action history', { threadId });
    }
  }
}

export default TicketRepository;
