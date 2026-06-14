import type { ModuleDefinition, RedisClient, InteractionResult } from '../../types/index.js';

import logger from './services/logging-service.js';

import * as Constants from './utils/constants.js';
import CustomIdUtils from './utils/custom-id-utils.js';
import * as Permissions from './utils/permissions.js';
import * as Validators from './utils/validators.js';
import { REDIS_KEYS, KEY_TTLS } from './utils/redis-keys.js';
import * as ErrorHandler from './utils/error-handler.js';

import TicketRepository from './repositories/ticket-repository.js';
import CooldownRepository from './repositories/cooldown-repository.js';

import CooldownService from './services/cooldown-service.js';
import LockService from './services/lock-service.js';
import WebhookService from './services/webhook-service.js';
import MetricsService from './services/metrics-service.js';
import DiscordRestService from './services/discord-rest-service.js';
import ReconciliationService from './services/reconciliation-service.js';
import CleanupService from './services/cleanup-service.js';
import ProductionService from './services/production-service.js';
import TicketService from './services/ticket-service.js';

import * as PayloadBuilders from './components/payloads.js';
import * as ButtonBuilders from './components/buttons.js';
import * as SelectBuilders from './components/selects.js';
import * as ModalBuilders from './components/modals.js';

import TicketCreationHandler from './handlers/ticket-creation.js';
import TicketResolutionHandler from './handlers/ticket-resolution.js';
import UserManagementHandler from './handlers/user-management.js';
import InteractionRouter from './handlers/interaction-router.js';

import TicketCommandHandler from './commands/ticket-command.js';

import CooldownCleanupJob from './jobs/cooldown-cleanup-job.js';
import ReconciliationJob from './jobs/reconciliation-job.js';

export interface TicketModuleOptions {
  database: any;
  redis: RedisClient;
  discordClient: any;
  environment?: string;
}

export interface TicketModule extends ModuleDefinition {
  services: {
    cooldown: CooldownService;
    lock: LockService;
    webhook: WebhookService;
    metrics: MetricsService;
    ticket: TicketService;
    reconciliation: ReconciliationService;
    cleanup: CleanupService;
    production: ProductionService;
  };
  repositories: {
    ticket: TicketRepository;
    cooldown: CooldownRepository;
  };
  handlers: {
    interactionRouter: InteractionRouter;
    ticketCommand: TicketCommandHandler;
    ticketCreation: TicketCreationHandler;
    ticketResolution: TicketResolutionHandler;
    userManagement: UserManagementHandler;
  };
  jobs: {
    cooldownCleanup: CooldownCleanupJob;
    reconciliation: ReconciliationJob;
  };
  shutdown: () => Promise<void>;
}

export async function initializeTicketsModule(options: TicketModuleOptions): Promise<TicketModule> {
  const {
    database,
    redis,
    discordClient,
    environment = 'development'
  } = options;

  logger.info('Initializing tickets module...', { environment });

  const ticketRepository = new TicketRepository(database);
  const cooldownRepository = new CooldownRepository(redis);

  const cooldownService = new CooldownService(cooldownRepository);
  const lockService = new LockService(redis);
  const webhookService = new WebhookService(redis);
  const metricsService = new MetricsService(redis);
  const discordRestService = new DiscordRestService(discordClient);
  const reconciliationService = new ReconciliationService(redis, ticketRepository, discordClient);
  const cleanupService = new CleanupService(redis, ticketRepository, cooldownRepository);
  const productionService = new ProductionService(environment);
  const ticketService = new TicketService(ticketRepository, cooldownService, lockService, metricsService);

  const ticketCreationHandler = new TicketCreationHandler(ticketService, lockService, discordRestService, webhookService, discordClient);
  const ticketResolutionHandler = new TicketResolutionHandler(ticketService, webhookService, discordClient);
  const userManagementHandler = new UserManagementHandler(ticketRepository, discordRestService);
  const interactionRouter = new InteractionRouter(
    lockService,
    ticketCreationHandler,
    ticketResolutionHandler,
    userManagementHandler
  );

  const ticketCommandHandler = new TicketCommandHandler();

  const cooldownCleanupJob = new CooldownCleanupJob(cooldownRepository, 60 * 60 * 1000);
  const reconciliationJob = new ReconciliationJob(reconciliationService, 60 * 60 * 1000);
  let cleanupIntervalId: ReturnType<typeof setInterval> | null = null;

  await productionService.initialize();

  await cooldownCleanupJob.start();
  await reconciliationJob.start();
  cleanupIntervalId = setInterval(async () => {
    await cleanupService.runCleanup().catch(() => null);
  }, 12 * 60 * 60 * 1000);

  logger.info('Tickets module initialized successfully');

  return {
    name: 'tickets',

    configSchema: {
      type: 'object',
      properties: {}
    },

    commands: [
      {
        name: 'ticket',
        description: 'Manage the ticket system',
        ephemeral: true,
        options: [
          {
            name: 'panel',
            type: 1,
            description: 'Send the ticket creation panel'
          },
          {
            name: 'manage',
            type: 2,
            description: 'Ticket management controls',
            options: [
              {
                name: 'users',
                type: 1,
                description: 'Open add/remove user controls for this ticket thread'
              }
            ]
          }
        ],
        async execute(interaction: any): Promise<InteractionResult> {
          try {
            await ticketCommandHandler.handleTicketCommand(interaction);
          } catch (error) {
            logger.error('Ticket command execution failed', { error: (error as Error).message, stack: (error as Error).stack });
            try {
              if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: `Error: ${(error as Error).message}` });
              } else {
                await interaction.reply({ content: `Error: ${(error as Error).message}`, ephemeral: true });
              }
            } catch (replyError) {
              logger.error('Failed to send error reply', { error: (replyError as Error).message });
            }
          }
          return { type: 'IGNORE' };
        }
      }
    ],

    events: [
      {
        name: 'interactionCreate',
        async execute(interaction: any) {
          if (interaction.isCommand()) return;
          if (
            !interaction.isButton() &&
            !interaction.isStringSelectMenu() &&
            !interaction.isModalSubmit()
          ) {
            return;
          }

          try {
            return await interactionRouter.routeInteraction(interaction);
          } catch (error) {
            logger.error('Ticket interaction handler failed', { error: (error as Error).message, stack: (error as Error).stack });
            return { type: 'ERROR', message: 'An unexpected error occurred.' };
          }
        }
      }
    ],

    services: {
      cooldown: cooldownService,
      lock: lockService,
      webhook: webhookService,
      metrics: metricsService,
      ticket: ticketService,
      reconciliation: reconciliationService,
      cleanup: cleanupService,
      production: productionService
    },

    repositories: {
      ticket: ticketRepository,
      cooldown: cooldownRepository
    },

    handlers: {
      interactionRouter,
      ticketCommand: ticketCommandHandler,
      ticketCreation: ticketCreationHandler,
      ticketResolution: ticketResolutionHandler,
      userManagement: userManagementHandler
    },

    jobs: {
      cooldownCleanup: cooldownCleanupJob,
      reconciliation: reconciliationJob
    },

    async shutdown(): Promise<void> {
      logger.info('Shutting down tickets module...');
      cooldownCleanupJob.stop();
      reconciliationJob.stop();
      if (cleanupIntervalId) clearInterval(cleanupIntervalId);
      logger.info('Tickets module shutdown complete');
    }
  };
}

export {
  Constants,
  CustomIdUtils,
  Permissions,
  Validators,
  REDIS_KEYS,
  KEY_TTLS,
  ErrorHandler,

  TicketRepository,
  CooldownRepository,

  CooldownService,
  LockService,
  WebhookService,
  MetricsService,
  DiscordRestService,
  ReconciliationService,
  CleanupService,
  ProductionService,
  TicketService,

  PayloadBuilders,
  ButtonBuilders,
  SelectBuilders,
  ModalBuilders,

  TicketCreationHandler,
  TicketResolutionHandler,
  UserManagementHandler,
  InteractionRouter,

  TicketCommandHandler,

  CooldownCleanupJob,
  ReconciliationJob
};

export default initializeTicketsModule;
