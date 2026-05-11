import { supabase } from '../../../database/supabase.js';

/**
 * Repository layer for ticket database operations
 * Handles all PostgreSQL queries and transactions
 */

export class TicketRepository {
  /**
   * Create a new ticket record
   * @param {Object} ticketData - Ticket data
   * @returns {Promise<Object>} Created ticket record
   */
  async create(ticketData) {
    const { data, error } = await supabase
      .from('tickets')
      .insert({
        guild_id: ticketData.guildId,
        thread_id: ticketData.threadId,
        creator_id: ticketData.creatorId,
        tag: ticketData.tag,
        tag_label: ticketData.tagLabel,
        welcome_message_id: ticketData.welcomeMessageId,
        log_message_id: ticketData.logMessageId,
        status: 'open'
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create ticket: ${error.message}`);
    }

    return data;
  }

  /**
   * Find ticket by thread ID
   * @param {string} threadId - Discord thread ID
   * @returns {Promise<Object|null>} Ticket record or null
   */
  async findByThreadId(threadId) {
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('thread_id', threadId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to find ticket by thread ID: ${error.message}`);
    }

    return data;
  }

  /**
   * Find open ticket by guild and creator
   * @param {string} guildId - Discord guild ID
   * @param {string} creatorId - Discord user ID
   * @returns {Promise<Object|null>} Open ticket record or null
   */
  async findOpenTicket(guildId, creatorId) {
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('guild_id', guildId)
      .eq('creator_id', creatorId)
      .eq('status', 'open')
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to find open ticket: ${error.message}`);
    }

    return data;
  }

  /**
   * Update ticket status
   * @param {string} threadId - Discord thread ID
   * @param {string} status - New status ('open', 'resolved', 'archived')
   * @param {Object} updateData - Additional update data
   * @returns {Promise<Object>} Updated ticket record
   */
  async updateStatus(threadId, status, updateData = {}) {
    const updateFields = {
      status,
      ...updateData
    };

    if (status === 'resolved') {
      updateFields.resolved_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('tickets')
      .update(updateFields)
      .eq('thread_id', threadId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update ticket status: ${error.message}`);
    }

    return data;
  }

  /**
   * Update ticket metadata
   * @param {string} threadId - Discord thread ID
   * @param {Object} metadata - Metadata to update
   * @returns {Promise<Object>} Updated ticket record
   */
  async updateMetadata(threadId, metadata) {
    const { data, error } = await supabase
      .from('tickets')
      .update(metadata)
      .eq('thread_id', threadId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update ticket metadata: ${error.message}`);
    }

    return data;
  }

  /**
   * Get all tickets for a guild with optional filters
   * @param {string} guildId - Discord guild ID
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} Array of ticket records
   */
  async findByGuild(guildId, filters = {}) {
    let query = supabase
      .from('tickets')
      .select('*')
      .eq('guild_id', guildId);

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.tag) {
      query = query.eq('tag', filters.tag);
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    if (filters.orderBy) {
      query = query.order(filters.orderBy, { ascending: filters.ascending ?? false });
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch tickets for guild: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get tickets by creator
   * @param {string} creatorId - Discord user ID
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} Array of ticket records
   */
  async findByCreator(creatorId, filters = {}) {
    let query = supabase
      .from('tickets')
      .select('*')
      .eq('creator_id', creatorId);

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch tickets for creator: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Delete a ticket record
   * @param {string} threadId - Discord thread ID
   * @returns {Promise<boolean>} True if deleted successfully
   */
  async delete(threadId) {
    const { error } = await supabase
      .from('tickets')
      .delete()
      .eq('thread_id', threadId);

    if (error) {
      throw new Error(`Failed to delete ticket: ${error.message}`);
    }

    return true;
  }

  /**
   * Get ticket statistics for a guild
   * @param {string} guildId - Discord guild ID
   * @param {Object} timeRange - Optional time range
   * @returns {Promise<Object>} Statistics object
   */
  async getStatistics(guildId, timeRange = {}) {
    let query = supabase
      .from('tickets')
      .select('*')
      .eq('guild_id', guildId);

    if (timeRange.startDate) {
      query = query.gte('created_at', timeRange.startDate);
    }

    if (timeRange.endDate) {
      query = query.lte('created_at', timeRange.endDate);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch ticket statistics: ${error.message}`);
    }

    const tickets = data || [];
    
    return {
      total: tickets.length,
      open: tickets.filter(t => t.status === 'open').length,
      resolved: tickets.filter(t => t.status === 'resolved').length,
      archived: tickets.filter(t => t.status === 'archived').length,
      byTag: tickets.reduce((acc, ticket) => {
        acc[ticket.tag] = (acc[ticket.tag] || 0) + 1;
        return acc;
      }, {})
    };
  }

  /**
   * Get tickets that need reconciliation (discrepancy detection)
   * @param {string} guildId - Discord guild ID
   * @returns {Promise<Array>} Array of tickets needing reconciliation
   */
  async findTicketsForReconciliation(guildId) {
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('guild_id', guildId)
      .in('status', ['open', 'resolved'])
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch tickets for reconciliation: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Batch update multiple tickets
   * @param {Array} threadIds - Array of thread IDs
   * @param {Object} updateData - Update data
   * @returns {Promise<Array>} Array of updated tickets
   */
  async batchUpdate(threadIds, updateData) {
    const { data, error } = await supabase
      .from('tickets')
      .update(updateData)
      .in('thread_id', threadIds)
      .select();

    if (error) {
      throw new Error(`Failed to batch update tickets: ${error.message}`);
    }

    return data || [];
  }
}

// Export singleton instance
export const ticketRepository = new TicketRepository();
