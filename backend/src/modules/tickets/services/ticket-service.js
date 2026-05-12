import { ticketRepository } from '../repositories/ticket-repository.js';
import { cooldownService } from './cooldown-service.js';

export class TicketService {
  async createTicket(ticketData) {
    return ticketRepository.create(ticketData);
  }

  async getTicketByThreadId(threadId) {
    return ticketRepository.findByThreadId(threadId);
  }

  async getOpenTicket(guildId, userId) {
    return ticketRepository.findOpenTicket(guildId, userId);
  }

  async updateTicketStatus(threadId, status, additionalData = {}) {
    return ticketRepository.updateStatus(threadId, status, additionalData);
  }

  async updateTicketMetadata(threadId, metadata) {
    return ticketRepository.updateMetadata(threadId, metadata);
  }

  async getGuildTickets(guildId, options = {}) {
    return ticketRepository.findByGuild(guildId, options);
  }

  async deleteTicket(threadId) {
    return ticketRepository.delete(threadId);
  }
  
  // Proxy methods needed by cleanup and reconciliation background jobs
  async getAllTickets(options = {}) {
    return ticketRepository.getAllTickets(options);
  }

  async getTicketsOlderThan(ms) {
    return ticketRepository.getTicketsOlderThan(ms);
  }

  async cleanupExpiredCooldowns() {
    return cooldownService.cleanupExpired();
  }
}

export const ticketService = new TicketService();