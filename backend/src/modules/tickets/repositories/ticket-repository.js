/**
 * Data repository for ticket operations.
 * Uses the shared Supabase repository module passed by the application bootstrap.
 */

import logger from '../services/logging-service.js';
import { DatabaseError, ValidationError } from '../utils/error-handler.js';
import { isValidDiscordId, isValidThreadId } from '../utils/validators.js';

const ACTIVE_STATUSES = ['open', 'in_progress', 'waiting_response'];

export class TicketRepository {
  constructor(database) {
    this.db = database;
  }

  async createTicket(data) {
    const { guildId, threadId, creatorId, tagValue, tagLabel, createdAt = new Date() } = data;

    if (!isValidDiscordId(guildId)) throw new ValidationError('Invalid guild ID');
    if (!isValidThreadId(threadId)) throw new ValidationError('Invalid thread ID');
    if (!isValidDiscordId(creatorId)) throw new ValidationError('Invalid creator ID');

    try {
      const rows = await this.db.fetchMany('tickets', (table) =>
        table
          .insert({
            guild_id: guildId,
            thread_id: threadId,
            creator_id: creatorId,
            tag: tagValue,
            tag_label: tagLabel || tagValue,
            thread_name: data.threadName || null,
            original_thread_name: data.threadName || null,
            status: 'open',
            created_at: createdAt,
            updated_at: createdAt,
            last_activity_at: createdAt
          })
          .select()
          .limit(1)
      );

      logger.info('Ticket created', { threadId, creatorId });
      return rows[0] ?? null;
    } catch (error) {
      logger.error('Failed to create ticket', { threadId, error: error.message });
      throw new DatabaseError('Failed to create ticket', { threadId });
    }
  }

  async getTicketByThreadId(threadId) {
    if (!isValidThreadId(threadId)) throw new ValidationError('Invalid thread ID');

    try {
      const rows = await this.db.fetchMany('tickets', (table) =>
        table.select('*').eq('thread_id', threadId).limit(1)
      );
      return rows[0] ?? null;
    } catch (error) {
      logger.error('Failed to fetch ticket', { threadId, error: error.message });
      throw new DatabaseError('Failed to fetch ticket', { threadId });
    }
  }

  async getActiveTicketsForUser(guildId, creatorId) {
    if (!isValidDiscordId(guildId)) throw new ValidationError('Invalid guild ID');
    if (!isValidDiscordId(creatorId)) throw new ValidationError('Invalid creator ID');

    try {
      return await this.db.fetchMany('tickets', (table) =>
        table
          .select('*')
          .eq('guild_id', guildId)
          .eq('creator_id', creatorId)
          .in('status', ACTIVE_STATUSES)
          .order('created_at', { ascending: false })
      );
    } catch (error) {
      logger.error('Failed to fetch active tickets', { guildId, creatorId, error: error.message });
      throw new DatabaseError('Failed to fetch active tickets');
    }
  }

  async resolveTicket(threadId, resolverId, resolvedAt = new Date()) {
    if (!isValidThreadId(threadId)) throw new ValidationError('Invalid thread ID');
    if (!isValidDiscordId(resolverId)) throw new ValidationError('Invalid resolver ID');

    try {
      const rows = await this.db.fetchMany('tickets', (table) =>
        table
          .update({
            status: 'resolved',
            resolved_at: resolvedAt,
            resolved_by: resolverId,
            is_archived: true,
            is_locked: true
          })
          .eq('thread_id', threadId)
          .select()
          .limit(1)
      );

      if (!rows[0]) {
        throw new DatabaseError('Ticket not found', { threadId });
      }

      logger.info('Ticket resolved', { threadId, resolverId });
      return rows[0];
    } catch (error) {
      if (error instanceof DatabaseError) throw error;
      logger.error('Failed to resolve ticket', { threadId, error: error.message });
      throw new DatabaseError('Failed to resolve ticket', { threadId });
    }
  }

  async getTicketStats(guildId) {
    if (!isValidDiscordId(guildId)) throw new ValidationError('Invalid guild ID');

    try {
      const rows = await this.db.fetchMany('tickets', (table) =>
        table.select('status').eq('guild_id', guildId)
      );

      return {
        total: rows.length,
        active: rows.filter((row) => ACTIVE_STATUSES.includes(row.status)).length,
        resolved: rows.filter((row) => row.status === 'resolved' || row.status === 'closed').length
      };
    } catch (error) {
      logger.error('Failed to fetch ticket stats', { guildId, error: error.message });
      throw new DatabaseError('Failed to fetch ticket stats', { guildId });
    }
  }

  async recordUserAction(data) {
    const { threadId, actionType, targetUserId, performedBy, performedAt = new Date() } = data;
    if (!isValidThreadId(threadId)) throw new ValidationError('Invalid thread ID');

    try {
      const rows = await this.db.fetchMany('ticket_user_actions', (table) =>
        table
          .insert({
            thread_id: threadId,
            action_type: actionType,
            target_user_id: targetUserId,
            performed_by: performedBy,
            performed_at: performedAt
          })
          .select()
          .limit(1)
      );

      logger.info('Ticket user action recorded', { threadId, actionType, targetUserId });
      return rows[0] ?? null;
    } catch (error) {
      logger.error('Failed to record user action', { threadId, error: error.message });
      throw new DatabaseError('Failed to record user action', { threadId });
    }
  }

  async getTicketActionHistory(threadId, limit = 50) {
    if (!isValidThreadId(threadId)) throw new ValidationError('Invalid thread ID');

    try {
      return await this.db.fetchMany('ticket_user_actions', (table) =>
        table
          .select('*')
          .eq('thread_id', threadId)
          .order('performed_at', { ascending: false })
          .limit(limit)
      );
    } catch (error) {
      logger.error('Failed to fetch action history', { threadId, error: error.message });
      throw new DatabaseError('Failed to fetch action history', { threadId });
    }
  }

  async deleteResolvedOlderThan(daysOld = 90) {
    try {
      const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();
      const rows = await this.db.fetchMany('tickets', (table) =>
        table
          .delete()
          .in('status', ['resolved', 'closed', 'orphaned'])
          .lt('resolved_at', cutoff)
          .select('thread_id')
      );
      return rows.length;
    } catch (error) {
      logger.error('Failed to delete old resolved tickets', { error: error.message, daysOld });
      throw new DatabaseError('Failed to delete old resolved tickets');
    }
  }
}

export default TicketRepository;
