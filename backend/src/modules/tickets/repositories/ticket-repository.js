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
      const result = await this.db.from('tickets').insert({
        guild_id: guildId,
        thread_id: threadId,
        creator_id: creatorId,
        tag_value: tagValue,
        created_at: createdAt
      }).select();

      logger.info('Ticket created', { threadId, creatorId });
      return result.data[0];
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
      const result = await this.db.from('tickets')
        .select('*')
        .eq('thread_id', threadId)
        .single();
      return result.data || null;
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
      const result = await this.db.from('tickets')
        .update({ 
          resolved_at: resolvedAt, 
          resolved_by: resolverId 
        })
        .eq('thread_id', threadId)
        .select();

      if (result.data.length === 0) {
        throw new DatabaseError('Ticket not found', { threadId });
      }

      logger.info('Ticket resolved', { threadId, resolverId });
      return result.data[0];
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
      const { data: result, error } = await this.db
        .from('ticket_user_actions')
        .insert({
          thread_id: threadId,
          action_type: actionType,
          target_user_id: targetUserId,
          performed_by: performedBy,
          performed_at: performedAt,
        })
        .select();

      if (error) {
        throw error;
      }

      logger.info('Ticket user action recorded', { threadId, actionType, targetUserId });
      return result[0];
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
