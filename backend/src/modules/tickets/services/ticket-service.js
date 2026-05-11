// DEPRECATED: This file has been replaced by enterprise architecture
// Use ticket-repository.js and the new services layer instead
// This file is kept for backward compatibility during migration

import { ticketRepository } from '../repositories/ticket-repository.js';

/**
 * @deprecated Use ticketRepository instead
 */
export class TicketService {
  async createTicket(ticketData) {
    console.warn('TicketService is deprecated. Use ticketRepository instead.');
    return ticketRepository.create(ticketData);
  }

  async getTicketByThreadId(threadId) {
    console.warn('TicketService is deprecated. Use ticketRepository instead.');
    return ticketRepository.findByThreadId(threadId);
  }

  async getOpenTicket(guildId, userId) {
    console.warn('TicketService is deprecated. Use ticketRepository instead.');
    return ticketRepository.findOpenTicket(guildId, userId);
  }

  async updateTicketStatus(threadId, status, additionalData = {}) {
    console.warn('TicketService is deprecated. Use ticketRepository instead.');
    return ticketRepository.updateStatus(threadId, status, additionalData);
  }

  async updateTicketMetadata(threadId, metadata) {
    console.warn('TicketService is deprecated. Use ticketRepository instead.');
    return ticketRepository.updateMetadata(threadId, metadata);
  }

  async getGuildTickets(guildId, options = {}) {
    console.warn('TicketService is deprecated. Use ticketRepository instead.');
    return ticketRepository.findByGuild(guildId, options);
  }

  async deleteTicket(threadId) {
    console.warn('TicketService is deprecated. Use ticketRepository instead.');
    return ticketRepository.delete(threadId);
  }
}

export const ticketService = new TicketService();
