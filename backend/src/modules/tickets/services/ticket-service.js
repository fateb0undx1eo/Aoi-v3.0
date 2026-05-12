/**
 * Ticket service - high-level ticket operations
 * Facade service that coordinates multiple repositories and services
 */

import logger from './logging-service.js';
import { PermissionError, ValidationError } from '../utils/error-handler.js';

export class TicketService {
  constructor(ticketRepository, cooldownService, lockService, metricsService) {
    this.ticketRepo = ticketRepository;
    this.cooldownService = cooldownService;
    this.lockService = lockService;
    this.metricsService = metricsService;
  }

  /**
   * Creates a new ticket with all validations
   */
  async createTicket(data) {
    const { guildId, threadId, creatorId, tagValue } = data;

    logger.info('Creating ticket', { guildId, threadId, creatorId, tagValue });

    // Check cooldown
    await this.cooldownService.checkCooldown(creatorId);

    // Create ticket record
    const ticket = await this.ticketRepo.createTicket(data);

    // Record metrics
    await this.metricsService.recordTicketCreation({ guildId, tagValue });

    return ticket;
  }

  /**
   * Resolves a ticket
   */
  async resolveTicket(threadId, resolverId, creatorId) {
    logger.info('Resolving ticket', { threadId, resolverId });

    // Update ticket record
    const ticket = await this.ticketRepo.resolveTicket(threadId, resolverId);

    // Apply cooldown to creator
    if (creatorId) {
      await this.cooldownService.applyCooldown(creatorId);
    }

    // Record metrics
    await this.metricsService.recordTicketResolution({ threadId });

    return ticket;
  }

  /**
   * Gets ticket by ID
   */
  async getTicket(threadId) {
    return this.ticketRepo.getTicketByThreadId(threadId);
  }

  /**
   * Gets active tickets for a user
   */
  async getUserActiveTickets(guildId, userId, channelId = null) {
    return this.ticketRepo.getActiveTicketsForUser(guildId, userId, channelId);
  }

  /**
   * Gets ticket statistics for a guild
   */
  async getGuildStats(guildId) {
    return this.ticketRepo.getTicketStats(guildId);
  }
}

export default TicketService;
