/**
 * Discord Bot & API Server Main Entry Point
 * Initializes Discord client, loads modules, sets up API server, and handles connections
 */

import { env } from './core/config/env.js';
import { createDiscordClient } from './core/discordClient.js';
import { redisClient } from './core/redis.js';
import * as database from './database/repository.js';
import { buildApiServer } from './api/server.js';
import { bootstrapRegistry } from './core/loader/bootstrap.js';
import { registerInteractionRouter } from './interactions/interactionRouter.js';
import { logger } from './utils/logger.js';
import { ConfigCache } from './core/configCache/configCache.js';
import { ConfigService } from './services/configService.js';
import { PermissionService } from './core/permissions/permissionService.js';
import { DynamicRateLimiter } from './core/rateLimiter/dynamicRateLimiter.js';
import { RateLimitService } from './services/rateLimitService.js';
import { DiscordCommandSyncService } from './services/discordCommandSyncService.js';
import { AuthService } from './services/authService.js';
import { GuildService } from './services/guildService.js';
import { AccessControlService } from './services/accessControlService.js';
import { AnalyticsService } from './services/analyticsService.js';
import { ModuleService } from './services/moduleService.js';
import { DashboardOverviewService } from './services/dashboardOverviewService.js';
import { ModerationService } from './services/moderationService.js';
import { SettingsService } from './services/settingsService.js';
import { AnnouncementService } from './services/announcementService.js';
import { DmBroadcastService } from './services/dmBroadcastService.js';
import { RoleColorRotationService } from './services/roleColorRotationService.js';
import { MemeService } from './services/memeService.js';
import { BotLooksService } from './services/botLooksService.js';
import { StaffListService } from './services/staffListService.js';
import { ProfileStyleService } from './services/profileStyleService.js';
import { StaffRatingService } from './services/staffRatingService.js';
import { PlaceholderEngine } from './core/placeholderEngine/placeholderEngine.js';

const PORT = env.apiPort || 3001;

async function main() {
  try {
    logger.info('🚀 Starting Discord Bot & API Server');

    // ─────────────────────────────────────────────────────────────
    // 1. Initialize Redis
    // ─────────────────────────────────────────────────────────────
    logger.info('Connecting to Redis...');
    const redisConnected = await redisClient.connect();
    if (!redisConnected && redisClient.isEnabled()) {
      logger.warn('⚠️  Redis unavailable - will operate in degraded mode');
    } else {
      logger.info('✓ Redis connected');
    }

    // ─────────────────────────────────────────────────────────────
    // 2. Initialize Database
    // ─────────────────────────────────────────────────────────────
    logger.info('Initializing database connection...');
    logger.info('✓ Database ready');

    // ─────────────────────────────────────────────────────────────
    // 3. Create Discord Client
    // ─────────────────────────────────────────────────────────────
    logger.info('Creating Discord client...');
    const discordClient = createDiscordClient();
    logger.info('✓ Discord client created');

    // ─────────────────────────────────────────────────────────────
    // 4. Load Module Registry
    // ─────────────────────────────────────────────────────────────
    logger.info('Loading module registry...');
    const registry = await bootstrapRegistry();
    logger.info(`✓ Loaded ${registry.listDefinitions().length} modules`);

    // ─────────────────────────────────────────────────────────────
    // 5. Initialize Async Modules (like tickets)
    // ─────────────────────────────────────────────────────────────
    logger.info('Initializing async modules...');
    await registry.initializeAsyncModules({
      database,
      redis: redisClient,
      discordClient,
      environment: env.environment || 'development'
    });
    logger.info('✓ Async modules initialized');

    // ─────────────────────────────────────────────────────────────
    // 6. Register Discord Events & Commands
    // ─────────────────────────────────────────────────────────────
    logger.info('Registering command and event handlers...');
    logger.debug(`Total commands in registry: ${registry.commands.size}`);
    logger.debug(`Total events in registry: ${registry.events.size}`);

    // Initialize services
    const configService = new ConfigService();
    const configCache = new ConfigCache(configService);
    const permissionService = new PermissionService();
    const rateLimitService = new RateLimitService();
    const rateLimiter = new DynamicRateLimiter(rateLimitService);
    const authService = new AuthService(env);
    const guildService = new GuildService();
    const accessControlService = new AccessControlService({ client: discordClient });
    const analyticsService = new AnalyticsService();
    const moduleService = new ModuleService(registry, configCache);
    const dashboardOverviewService = new DashboardOverviewService({ client: discordClient, moduleService, analyticsService });
    const moderationService = new ModerationService(configService);
    const settingsService = new SettingsService(configService);
    const announcementService = new AnnouncementService({ client: discordClient });
    const placeholderEngine = new PlaceholderEngine();
    const dmBroadcastService = new DmBroadcastService({ client: discordClient, placeholderEngine });
    const roleColorRotationService = new RoleColorRotationService({ client: discordClient, configService, configCache });
    const memeService = new MemeService({ configService, configCache, client: discordClient, env });
    const botLooksService = new BotLooksService({ client: discordClient, configService, configCache, preferredGuildId: env.discord.guildId });
    const staffListService = new StaffListService({ client: discordClient, configService, configCache });
    const profileStyleService = new ProfileStyleService({ client: discordClient, configService, configCache, token: env.discord.token });
    const staffRatingService = new StaffRatingService();

    const services = {
      configService,
      authService,
      guildService,
      accessControlService,
      analyticsService,
      moduleService,
      dashboardOverviewService,
      moderationService,
      settingsService,
      announcementService,
      dmBroadcastService,
      roleColorRotationService,
      memeService,
      botLooksService,
      staffListService,
      profileStyleService,
      staffRatingService
    };

    const context = {
      database,
      redis: redisClient,
      discordClient,
      configCache,
      configService,
      permissionService,
      rateLimiter,
      authService,
      guildService,
      accessControlService,
      analyticsService,
      moduleService,
      dashboardOverviewService,
      moderationService,
      settingsService,
      announcementService,
      dmBroadcastService,
      roleColorRotationService,
      memeService,
      botLooksService,
      staffListService,
      profileStyleService,
      staffRatingService,
      placeholderEngine,
      services,
      client: discordClient,
      env,
      registry
    };

    // Register event handlers for all loaded modules FIRST
    for (const [eventName, handlers] of registry.events.entries()) {
      if (handlers.length > 0) {
        logger.debug(
          `Registering ${handlers.length} handler(s) for event: ${eventName}`
        );

        discordClient.on(eventName, async (...args) => {
          for (const handler of handlers) {
            try {
              await handler.execute(...args, context);
            } catch (error) {
              logger.error(
                `Event handler ${handler.moduleName}/${eventName} failed:`,
                error
              );
            }
          }
        });
      }
    }

    // Register main interaction router LAST (only for commands)
    registerInteractionRouter(discordClient, registry, context);

    logger.info('✓ Handlers registered');

    // ─────────────────────────────────────────────────────────────
    // 7. Sync Discord Commands
    // ─────────────────────────────────────────────────────────────
    logger.info('Syncing Discord slash commands...');
    const commandSync = new DiscordCommandSyncService(env, registry);
    try {
      await commandSync.syncGuildCommands();
      logger.info('✓ Discord commands synced');
    } catch (error) {
      logger.error('Failed to sync Discord commands:', error);
      throw error;
    }

    // ─────────────────────────────────────────────────────────────
    // 8. Setup Discord Client Ready Event
    // ─────────────────────────────────────────────────────────────
    discordClient.once('ready', () => {
      logger.info(`✓ Discord Bot Ready! Logged in as ${discordClient.user.tag}`);
      logger.info(`  Serving ${discordClient.guilds.cache.size} guilds`);
    });

    discordClient.on('error', (error) => {
      logger.error('Discord client error:', error);
    });

    // ─────────────────────────────────────────────────────────────
    // 8. Build & Start Express API Server
    // ─────────────────────────────────────────────────────────────
    logger.info('Building Express server...');
    const app = buildApiServer(context);
    
    const server = app.listen(PORT, () => {
      logger.info(`✓ Express server listening on port ${PORT}`);
      logger.info(`📡 API available at http://localhost:${PORT}`);
    });

    // ─────────────────────────────────────────────────────────────
    // 9. Login Discord Bot
    // ─────────────────────────────────────────────────────────────
    logger.info('Logging in Discord bot...');
    await discordClient.login(env.discord.token);

    // ─────────────────────────────────────────────────────────────
    // 10. Handle Shutdown Gracefully
    // ─────────────────────────────────────────────────────────────
    const gracefulShutdown = async (signal) => {
      logger.info(`\n📴 Received ${signal}, shutting down gracefully...`);

      // Close API server
      server.close(async () => {
        logger.info('✓ Express server closed');

        // Disconnect Discord client
        discordClient.destroy();
        logger.info('✓ Discord bot disconnected');

        // Close Redis
        await redisClient.disconnect?.();
        logger.info('✓ Redis disconnected');

        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    logger.info('✅ All systems ready!\n');
  } catch (error) {
    logger.error('❌ Startup failed:', error);
    process.exit(1);
  }
}

main();
