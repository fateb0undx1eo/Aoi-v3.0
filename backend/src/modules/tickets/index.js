/**
 * Tickets Module - Main Entry Point
 * Exports module configuration and command/event handlers
 */

import logger from './services/logging-service.js';

// Utilities
import * as Constants from './utils/constants.js';
import CustomIdUtils from './utils/custom-id-utils.js';
import * as Permissions from './utils/permissions.js';
import * as Validators from './utils/validators.js';
import { REDIS_KEYS, KEY_TTLS } from './utils/redis-keys.js';
import * as ErrorHandler from './utils/error-handler.js';

// Repositories
import TicketRepository from './repositories/ticket-repository.js';
import CooldownRepository from './repositories/cooldown-repository.js';

// Services
import CooldownService from './services/cooldown-service.js';
import LockService from './services/lock-service.js';
import WebhookService from './services/webhook-service.js';
import MetricsService from './services/metrics-service.js';
import DiscordRestService from './services/discord-rest-service.js';
import ReconciliationService from './services/reconciliation-service.js';
import CleanupService from './services/cleanup-service.js';
import ProductionService from './services/production-service.js';
import TicketService from './services/ticket-service.js';

// Components
import * as PayloadBuilders from './components/payloads.js';
import * as ButtonBuilders from './components/buttons.js';
import * as SelectBuilders from './components/selects.js';
import * as ModalBuilders from './components/modals.js';

// Handlers
import TicketCreationHandler from './handlers/ticket-creation.js';
import TicketResolutionHandler from './handlers/ticket-resolution.js';
import UserManagementHandler from './handlers/user-management.js';
import InteractionRouter from './handlers/interaction-router.js';

// Commands
import TicketCommandHandler from './commands/ticket-command.js';

// Jobs
import CooldownCleanupJob from './jobs/cooldown-cleanup-job.js';
import ReconciliationJob from './jobs/reconciliation-job.js';

/**
 * Initializes the tickets module with all services and handlers
 */
export async function initializeTicketsModule(options) {
  const {
    database,
    redis,
    discordClient,
    environment = 'development'
  } = options;

  logger.info({ environment }, 'Initializing tickets module...');

  // Initialize repositories
  const ticketRepository = new TicketRepository(database);
  const cooldownRepository = new CooldownRepository(redis);

  // Initialize services
  const cooldownService = new CooldownService(cooldownRepository);
  const lockService = new LockService(redis);
  const webhookService = new WebhookService(redis);
  const metricsService = new MetricsService(redis);
  const discordRestService = new DiscordRestService(discordClient);
  const reconciliationService = new ReconciliationService(redis, ticketRepository, discordClient);
  const cleanupService = new CleanupService(redis, ticketRepository, cooldownRepository);
  const productionService = new ProductionService(environment);
  const ticketService = new TicketService(ticketRepository, cooldownService, lockService, metricsService);

  // Initialize handlers
  const ticketCreationHandler = new TicketCreationHandler(ticketService, lockService, discordRestService, webhookService, discordClient);
  const ticketResolutionHandler = new TicketResolutionHandler(
    ticketService,
    webhookService,
    discordClient
  );
  const userManagementHandler = new UserManagementHandler(ticketRepository, discordRestService);
  const interactionRouter = new InteractionRouter(
    lockService,
    ticketCreationHandler,
    ticketResolutionHandler,
    userManagementHandler
  );

  // Initialize command handler
  const ticketCommandHandler = new TicketCommandHandler();

  // Initialize jobs
  const cooldownCleanupJob = new CooldownCleanupJob(cooldownRepository, 60 * 60 * 1000); // 1 hour
  const reconciliationJob = new ReconciliationJob(reconciliationService, 60 * 60 * 1000); // 1 hour
  let cleanupIntervalId = null;

  // Start services
  await productionService.initialize();

  // Start background jobs
  await cooldownCleanupJob.start();
  await reconciliationJob.start();
  cleanupIntervalId = setInterval(async () => {
    await cleanupService.runCleanup().catch(() => null);
  }, 12 * 60 * 60 * 1000);

  logger.info('Tickets module initialized successfully');

  // Return the module instance with all handlers and services
  return {
    name: 'tickets',

    configSchema: {
      type: 'object',
      properties: {}
    },

    // Slash commands
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
        async execute(interaction) {
          try {
            // Don't defer here - global router already deferred this
            await ticketCommandHandler.handleTicketCommand(interaction);
          } catch (error) {
            logger.error('Ticket command execution failed', { error: error.message, stack: error.stack });
            try {
              if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: `Error: ${error.message}` });
              } else {
                await interaction.reply({ content: `Error: ${error.message}`, ephemeral: true });
              }
            } catch (replyError) {
              logger.error('Failed to send error reply', { error: replyError.message });
            }
          }
        }
      }
    ],

    // Event listeners
    events: [
      {
        name: 'interactionCreate',
        async execute(interaction) {
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
            logger.error('Ticket interaction handler failed', { error: error.message, stack: error.stack });
            return { type: 'ERROR', message: 'An unexpected error occurred.' };
          }
        }
      }
    ],

    // Exposed services and utilities for other modules
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

    // Cleanup on shutdown
    async shutdown() {
      logger.info('Shutting down tickets module...');
      cooldownCleanupJob.stop();
      reconciliationJob.stop();
      if (cleanupIntervalId) clearInterval(cleanupIntervalId);
      logger.info('Tickets module shutdown complete');
    }
  };
}

// Export individual components for direct use
export {
  // Utils
  Constants,
  CustomIdUtils,
  Permissions,
  Validators,
  REDIS_KEYS,
  KEY_TTLS,
  ErrorHandler,

  // Repositories
  TicketRepository,
  CooldownRepository,

  // Services
  CooldownService,
  LockService,
  WebhookService,
  MetricsService,
  DiscordRestService,
  ReconciliationService,
  CleanupService,
  ProductionService,
  TicketService,

  // Components
  PayloadBuilders,
  ButtonBuilders,
  SelectBuilders,
  ModalBuilders,

  // Handlers
  TicketCreationHandler,
  TicketResolutionHandler,
  UserManagementHandler,
  InteractionRouter,

  // Commands
  TicketCommandHandler,

  // Jobs
  CooldownCleanupJob,
  ReconciliationJob
};

export default initializeTicketsModule;
