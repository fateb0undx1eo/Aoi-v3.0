import { supabase } from '../../../database/supabase.js';

export class TicketRepository {
  async create(ticketData) {
    const { data, error } = await supabase.from('tickets').insert({
      guild_id: ticketData.guildId,
      thread_id: ticketData.threadId,
      creator_id: ticketData.creatorId,
      tag: ticketData.tag,
      tag_label: ticketData.tagLabel,
      welcome_message_id: ticketData.welcomeMessageId,
      log_message_id: ticketData.logMessageId,
      status: 'open'
    }).select().single();
    if (error) throw new Error(`Failed to create ticket: ${error.message}`);
    return data;
  }

  async findByThreadId(threadId) {
    const { data, error } = await supabase.from('tickets').select('*').eq('thread_id', threadId).single();
    if (error && error.code !== 'PGRST116') throw new Error(`Failed to find ticket by thread ID: ${error.message}`);
    return data;
  }

  async findOpenTicket(guildId, creatorId) {
    const { data, error } = await supabase.from('tickets').select('*').eq('guild_id', guildId).eq('creator_id', creatorId).eq('status', 'open').single();
    if (error && error.code !== 'PGRST116') throw new Error(`Failed to find open ticket: ${error.message}`);
    return data;
  }

  async updateStatus(threadId, status, updateData = {}) {
    const updateFields = { status, ...updateData };
    if (status === 'resolved') updateFields.resolved_at = new Date().toISOString();
    const { data, error } = await supabase.from('tickets').update(updateFields).eq('thread_id', threadId).select().single();
    if (error) throw new Error(`Failed to update ticket status: ${error.message}`);
    return data;
  }

  async updateMetadata(threadId, metadata) {
    const { data, error } = await supabase.from('tickets').update(metadata).eq('thread_id', threadId).select().single();
    if (error) throw new Error(`Failed to update ticket metadata: ${error.message}`);
    return data;
  }

  async findByGuild(guildId, filters = {}) {
    let query = supabase.from('tickets').select('*').eq('guild_id', guildId);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.tag) query = query.eq('tag', filters.tag);
    if (filters.limit) query = query.limit(filters.limit);
    if (filters.orderBy) query = query.order(filters.orderBy, { ascending: filters.ascending ?? false });
    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch tickets for guild: ${error.message}`);
    return data ||[];
  }

  async findByCreator(creatorId, filters = {}) {
    let query = supabase.from('tickets').select('*').eq('creator_id', creatorId);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.limit) query = query.limit(filters.limit);
    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch tickets for creator: ${error.message}`);
    return data ||[];
  }

  async delete(threadId) {
    const { error } = await supabase.from('tickets').delete().eq('thread_id', threadId);
    if (error) throw new Error(`Failed to delete ticket: ${error.message}`);
    return true;
  }

  async getStatistics(guildId, timeRange = {}) {
    let query = supabase.from('tickets').select('*').eq('guild_id', guildId);
    if (timeRange.startDate) query = query.gte('created_at', timeRange.startDate);
    if (timeRange.endDate) query = query.lte('created_at', timeRange.endDate);
    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch ticket statistics: ${error.message}`);
    const tickets = data ||[];
    return {
      total: tickets.length,
      open: tickets.filter(t => t.status === 'open').length,
      resolved: tickets.filter(t => t.status === 'resolved').length,
      archived: tickets.filter(t => t.status === 'archived').length,
      byTag: tickets.reduce((acc, ticket) => { acc[ticket.tag] = (acc[ticket.tag] || 0) + 1; return acc; }, {})
    };
  }

  async findTicketsForReconciliation(guildId) {
    const { data, error } = await supabase.from('tickets').select('*').eq('guild_id', guildId).in('status', ['open', 'resolved']).order('created_at', { ascending: false });
    if (error) throw new Error(`Failed to fetch tickets for reconciliation: ${error.message}`);
    return data ||[];
  }

  async batchUpdate(threadIds, updateData) {
    const { data, error } = await supabase.from('tickets').update(updateData).in('thread_id', threadIds).select();
    if (error) throw new Error(`Failed to batch update tickets: ${error.message}`);
    return data ||[];
  }

  async findOpenTickets() {
    const { data, error } = await supabase.from('tickets').select('*').eq('status', 'open');
    if (error) throw new Error(`Failed to find open tickets: ${error.message}`);
    return data ||[];
  }

  async getAllTickets(options = {}) {
    let query = supabase.from('tickets').select('*');
    if (options.limit) query = query.limit(options.limit);
    const { data, error } = await query;
    if (error) throw new Error(`Failed to get all tickets: ${error.message}`);
    return data ||[];
  }

  async getTicketsOlderThan(ms) {
    const date = new Date(Date.now() - ms).toISOString();
    const { data, error } = await supabase.from('tickets').select('*').lt('created_at', date);
    if (error) throw new Error(`Failed to get older tickets: ${error.message}`);
    return data ||[];
  }

  async deleteOldOrphanedTickets(days) {
    const date = new Date(Date.now() - (days * 24 * 60 * 60 * 1000)).toISOString();
    const { data, error } = await supabase.from('tickets').delete().eq('status', 'orphaned').lt('created_at', date).select('id');
    if (error) throw new Error(`Failed to delete orphaned tickets: ${error.message}`);
    return data ? data.length : 0;
  }
}

export const ticketRepository = new TicketRepository();