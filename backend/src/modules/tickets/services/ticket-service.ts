import logger from './logging-service.js';
import type TicketRepository from '../repositories/ticket-repository.js';
import type CooldownService from './cooldown-service.js';
import type LockService from './lock-service.js';
import type MetricsService from './metrics-service.js';

interface TicketData {
  guildId: string;
  threadId: string;
  creatorId: string;
  tagValue: string;
  tagLabel?: string;
  threadName?: string;
  createdAt?: Date;
}

export class TicketService {
  private ticketRepo: TicketRepository;
  private cooldownService: CooldownService;
  private lockService: LockService;
  private metricsService: MetricsService;

  constructor(
    ticketRepository: TicketRepository,
    cooldownService: CooldownService,
    lockService: LockService,
    metricsService: MetricsService
  ) {
    this.ticketRepo = ticketRepository;
    this.cooldownService = cooldownService;
    this.lockService = lockService;
    this.metricsService = metricsService;
  }

  async createTicket(data: TicketData): Promise<any> {
    const { guildId, threadId, creatorId, tagValue } = data;

    logger.info('Creating ticket', { guildId, threadId, creatorId, tagValue });

    await this.cooldownService.checkCooldown(creatorId);

    const ticket = await this.ticketRepo.createTicket(data);

    await this.metricsService.recordTicketCreation({ guildId, tagValue });

    return ticket;
  }

  async resolveTicket(threadId: string, resolverId: string, creatorId: string): Promise<any> {
    logger.info('Resolving ticket', { threadId, resolverId });

    const ticket = await this.ticketRepo.resolveTicket(threadId, resolverId);

    if (creatorId) {
      await this.cooldownService.applyCooldown(creatorId);
    }

    await this.metricsService.recordTicketResolution({ threadId });

    return ticket;
  }

  async getTicket(threadId: string): Promise<any> {
    return this.ticketRepo.getTicketByThreadId(threadId);
  }

  async getUserActiveTickets(guildId: string, userId: string): Promise<any[]> {
    return this.ticketRepo.getActiveTicketsForUser(guildId, userId);
  }

  async getGuildStats(guildId: string): Promise<any> {
    return this.ticketRepo.getTicketStats(guildId);
  }

  async checkCooldown(userId: string): Promise<true> {
    return this.cooldownService.checkCooldown(userId);
  }

  async applyCooldown(userId: string): Promise<number> {
    return this.cooldownService.applyCooldown(userId);
  }
}

export default TicketService;
