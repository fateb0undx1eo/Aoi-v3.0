import { fetchOne, fetchMany, upsertRows, updateWhere, deleteWhere } from '../../../database/repository.js';
import { RepositoryError } from '../../../database/repository.js';

/**
 * Ticket metadata service - replaces message scanning with database lookups
 */

export class TicketService {
  /**
   * Create a new ticket record
   */
  async createTicket(ticketData) {
    try {
      const [ticket] = await upsertRows('tickets', {
        guild_id: ticketData.guildId,
        thread_id: ticketData.threadId,
        creator_id: ticketData.creatorId,
        tag: ticketData.tag,
        tag_label: ticketData.tagLabel,
        welcome_message_id: ticketData.welcomeMessageId || null,
        status: 'open',
        thread_name: ticketData.threadName,
        auto_archive_duration: ticketData.autoArchiveDuration || 1440
      });
      return ticket;
    } catch (error) {
      throw new RepositoryError('Failed to create ticket', error);
    }
  }

  /**
   * Get ticket by thread ID
   */
  async getTicketByThreadId(threadId) {
    try {
      return await fetchOne('tickets', (query) => 
        query.eq('thread_id', threadId)
      );
    } catch (error) {
      throw new RepositoryError('Failed to get ticket by thread ID', error);
    }
  }

  /**
   * Get open ticket for user in guild
   */
  async getOpenTicket(guildId, userId) {
    try {
      return await fetchOne('tickets', (query) =>
        query
          .eq('guild_id', guildId)
          .eq('creator_id', userId)
          .eq('status', 'open')
      );
    } catch (error) {
      throw new RepositoryError('Failed to get open ticket', error);
    }
  }

  /**
   * Update ticket status and metadata
   */
  async updateTicket(threadId, updates) {
    try {
      const [ticket] = await updateWhere('tickets', updates, (query) =>
        query.eq('thread_id', threadId)
      );
      return ticket;
    } catch (error) {
      throw new RepositoryError('Failed to update ticket', error);
    }
  }

  /**
   * Mark ticket as resolved
   */
  async resolveTicket(threadId, resolverId) {
    return this.updateTicket(threadId, {
      status: 'resolved',
      resolved_by: resolverId,
      resolved_at: new Date().toISOString()
    });
  }

  /**
   * Reopen ticket
   */
  async reopenTicket(threadId) {
    return this.updateTicket(threadId, {
      status: 'open',
      resolved_by: null,
      resolved_at: null
    });
  }

  /**
   * Update welcome message ID
   */
  async updateWelcomeMessageId(threadId, messageId) {
    return this.updateTicket(threadId, {
      welcome_message_id: messageId
    });
  }

  /**
   * Update log message IDs
   */
  async updateLogMessageIds(threadId, logMessageId, resolvedLogMessageId = null) {
    const updates = { log_message_id: logMessageId };
    if (resolvedLogMessageId) {
      updates.resolved_log_message_id = resolvedLogMessageId;
    }
    return this.updateTicket(threadId, updates);
  }

  /**
   * Get all active tickets for guild
   */
  async getActiveGuildTickets(guildId) {
    try {
      return await fetchMany('tickets', (query) =>
        query
          .eq('guild_id', guildId)
          .in('status', ['open', 'resolved'])
          .order('created_at', { ascending: false })
      );
    } catch (error) {
      throw new RepositoryError('Failed to get active guild tickets', error);
    }
  }

  /**
   * Delete ticket record
   */
  async deleteTicket(threadId) {
    try {
      await deleteWhere('tickets', (query) =>
        query.eq('thread_id', threadId)
      );
    } catch (error) {
      throw new RepositoryError('Failed to delete ticket', error);
    }
  }
}

export const ticketService = new TicketService();
