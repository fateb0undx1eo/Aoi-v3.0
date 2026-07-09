// BigInt polyfill: Discord.js v14 uses BigInt for snowflakes, which JSON.stringify can't handle
BigInt.prototype.toJSON = function () { return this.toString(); };

import { REST } from '@discordjs/rest';
import { WebSocketManager } from '@discordjs/ws';
import { GatewayDispatchEvents, GatewayIntentBits } from '@discordjs/core';
import { env } from './core/config/env.js';
import { createDiscordClient } from './core/discordClient.js';
import { redisClient } from './core/redis.js';
import * as database from './database/repository.js';
import { buildApiServer } from './api/server.js';
import { attachOverviewSocketServer } from './api/overviewSocketServer.js';
import { attachLogsSocketServer } from './api/logsSocketServer.js';
import { logStreamService } from './services/logStreamService.js';
import { bootstrapRegistry } from './core/loader/bootstrap.js';
import { JobQueue } from './core/queue/jobQueue.js';
import { registerInteractionRouter } from './interactions/interactionRouter.js';
import { logger } from './utils/logger.js';
import { metrics } from './observability/metrics.js';
import { registerRuntimeFaultHandlers } from './observability/runtimeFaults.js';
import { runtimeState } from './observability/runtimeState.js';
import { RuntimeSupervisor } from './observability/supervisor.js';
import { ConfigCache } from './core/configCache/configCache.js';
import { ConfigService } from './services/configService.js';
import { PermissionService } from './core/permissions/permissionService.js';
import { DynamicRateLimiter } from './core/rateLimiter/dynamicRateLimiter.js';
import { RateLimitService } from './services/rateLimitService.js';
import type { BuildResult } from './api/server.js';
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
import { UploadService } from './services/upload/uploadService.js';
import { PresetService } from './services/presetService.js';
import { loadUploadConfig } from './services/upload/config.js';
import { DmBroadcastService } from './services/dmBroadcastService.js';
import { RoleColorRotationService } from './services/roleColorRotationService.js';
import { MemeService } from './services/memeService.js';
import { BotLooksService } from './services/botLooksService.js';
import { StaffListService } from './services/staffListService.js';
import { ProfileStyleService } from './services/profileStyleService.js';
import { StaffRatingService } from './services/staffRatingService.js';
import { CommunityService } from './services/communityService.js';
import { ToolsService } from './services/toolsService.js';
import { FunService } from './services/funService.js';
import { PlaceholderEngine } from './core/placeholderEngine/placeholderEngine.js';
import type { BotContext, ModuleRegistry } from './types/index.js';
import type { Client } from 'discord.js';

const PORT = env.apiPort || 3001;
let isShuttingDown = false;

type AnyServer = Record<string, any>;

async function shutdownRuntime(options: Record<string, any> = {}): Promise<void> {
  const {
    signal = 'manual',
    server = null,
    overviewSocketServer = null,
    configCache = null,
    registry = null,
    discordClient = null,
    supervisor = null,
    queues = [],
    exitCode = 0,
    forceExit = false
  } = options;

  if (isShuttingDown) return;
  isShuttingDown = true;
  runtimeState.shuttingDown = true;
  logger.info('Runtime shutdown started', { signal, exitCode });

  const forceTimer = setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);

  const closeServer = (): Promise<void> => new Promise((resolve) => {
    if (!server) {
      resolve();
      return;
    }
    server.close(() => resolve());
  });

  await closeServer();
  overviewSocketServer?.close?.();
  supervisor?.stop?.();
  configCache?.stopAutoRefresh?.();
  await Promise.allSettled(queues.map((queue: any) => queue.stop()));

  await Promise.allSettled(
    (registry?.listDefinitions?.() ?? [])
      .filter((definition: any) => typeof definition.shutdown === 'function')
      .map((definition: any) => definition.shutdown())
  );

  discordClient?.destroy?.();
  await redisClient.disconnect?.();
  clearTimeout(forceTimer);
  logger.info('Runtime shutdown complete', { signal, exitCode });

  if (forceExit || signal !== 'manual') {
    process.exit(exitCode);
  }
}

async function main(): Promise<void> {
  try {
    logger.info('🚀 Starting Discord Bot & API Server');

    // ─────────────────────────────────────────────────────────────
    // 0. Create @discordjs REST client
    // ─────────────────────────────────────────────────────────────
    const rest = new REST({ version: '10' }).setToken(env.discord.token);

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
    // 5. Upload Service
    // ─────────────────────────────────────────────────────────────
    const uploadConfig = loadUploadConfig();
    const uploadService = new UploadService(uploadConfig);

    // ─────────────────────────────────────────────────────────────
    // 6. Initialize Async Modules (like tickets)
    // ─────────────────────────────────────────────────────────────
    logger.info('Initializing async modules...');
    await registry.initializeAsyncModules({
      database,
      redis: redisClient,
      discordClient,
      environment: env.nodeEnv || 'development'
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
    const announcementService = new AnnouncementService({ client: discordClient, uploadService });
    const presetService = new PresetService();
    const placeholderEngine = new PlaceholderEngine();
    let dmBroadcastService: DmBroadcastService | null = null;
    const operationalQueue = new JobQueue({
      name: 'operational',
      redis: redisClient,
      handlers: {
        dm_broadcast: (payload: any) => (dmBroadcastService as DmBroadcastService).runQueuedBroadcast(payload)
      },
      concurrency: Number(process.env.OPERATIONAL_QUEUE_CONCURRENCY || 1)
    });
    dmBroadcastService = new DmBroadcastService({ client: discordClient, placeholderEngine, jobQueue: operationalQueue });
    const roleColorRotationService = new RoleColorRotationService({ client: discordClient, configService, configCache });
    const memeService = new MemeService({ configService, configCache, client: discordClient, env });
    const botLooksService = new BotLooksService({ client: discordClient, configService, configCache, preferredGuildId: env.discord.guildId ?? undefined });
    const staffListService = new StaffListService({ client: discordClient, configService, configCache });
    const profileStyleService = new ProfileStyleService({ client: discordClient, configService, configCache, token: env.discord.token });
    const staffRatingService = new StaffRatingService();
    const communityService = new CommunityService(configService, staffRatingService);
    const toolsService = new ToolsService(configService);
    const funService = new FunService({ configService });

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
      presetService,
      dmBroadcastService,
      roleColorRotationService,
      memeService,
      botLooksService,
      staffListService,
      profileStyleService,
      staffRatingService,
      communityService,
      toolsService,
      funService
    };

    const queues = [operationalQueue];
    const queueStats = () => queues.map((queue) => queue.stats());
    let overviewSocketServer: any = null;

    const context = {
      database,
      redis: redisClient,
      discordClient,
      rest,
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
      presetService,
      dmBroadcastService,
      roleColorRotationService,
      uploadService,
      memeService,
      botLooksService,
      staffListService,
      profileStyleService,
      staffRatingService,
      communityService,
      toolsService,
      placeholderEngine,
      services,
      queueStats,
      websocketStats: () => overviewSocketServer?.getStats?.() ?? { connections: 0 },
      client: discordClient,
      env,
      registry
    } as unknown as BotContext;

    // Register event handlers for all loaded modules FIRST
    // interactionCreate is handled exclusively by the router below
    for (const [eventName, handlers] of registry.events.entries()) {
      if (eventName === 'interactionCreate') continue;
      if (handlers.length > 0) {
        logger.debug(
          `Registering ${handlers.length} handler(s) for event: ${eventName}`
        );

        discordClient.on(eventName, async (...args: any[]) => {
          for (const handler of handlers) {
            try {
              await handler.execute(...args, context);
            } catch (error: any) {
              logger.error(
                `Event handler ${handler.moduleName}/${eventName} failed:`,
                error
              );
            }
          }
        });
      }
    }

    // Register main interaction router — single source of truth
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
    } catch (error: any) {
      logger.error('Failed to sync Discord commands:', error);
      throw error;
    }

    // ─────────────────────────────────────────────────────────────
    // 8. Setup Discord Client Ready Event
    // ─────────────────────────────────────────────────────────────
    discordClient.once('clientReady' as any, () => {
      logger.info(`✓ Discord Bot Ready! Logged in as ${(discordClient as any).user.tag}`);
      logger.info(`  Serving ${discordClient.guilds.cache.size} guilds`);
      const getGuildIds = () => [...discordClient.guilds.cache.keys()];
      Promise.allSettled(getGuildIds().map((guildId) => configCache.warmGuild(guildId)))
        .then(() => logger.info('Config cache warmed'))
        .catch((error: any) => logger.warn('Config cache warm failed', error));
      Promise.allSettled(getGuildIds().map((guildId) => rateLimiter.warmGuild(guildId)))
        .then(() => logger.info('Rate-limit rules warmed'))
        .catch((error: any) => logger.warn('Rate-limit warm failed', error));
      configCache.startAutoRefresh(getGuildIds);
    });

    discordClient.on('error', (error: any) => {
      logger.error('Discord client error:', error);
    });

    // ─────────────────────────────────────────────────────────────
    // 8. Build & Start Fastify API Server
    // ─────────────────────────────────────────────────────────────
    logger.info('Building Fastify server...');
    const { fastify, server } = buildApiServer(context) as BuildResult;

    overviewSocketServer = attachOverviewSocketServer({
      server,
      authService,
      accessControlService,
      dashboardOverviewService,
      metrics
    });
    attachLogsSocketServer({ server, authService });

    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    logger.info(`✓ Fastify server listening on port ${PORT}`);
    logger.info(`📡 API available at http://localhost:${PORT}`);

    // ─────────────────────────────────────────────────────────────
    // 9. Login Discord Bot
    // ─────────────────────────────────────────────────────────────
    operationalQueue.start();
    const supervisor = new RuntimeSupervisor({
      runtimeState,
      redis: redisClient,
      database,
      discordClient,
      websocketStats: () => overviewSocketServer?.getStats?.() ?? { connections: 0 }
    });
    supervisor.start();

    logger.info('Logging in Discord bot...');
    await discordClient.login(env.discord.token);

    // ─────────────────────────────────────────────────────────────
    // 10. Handle Shutdown Gracefully
    // ─────────────────────────────────────────────────────────────
    const gracefulShutdown = (signal: string) => shutdownRuntime({
      signal,
      server,
      overviewSocketServer,
      configCache,
      registry,
      discordClient,
      supervisor,
      queues,
      exitCode: 0,
      forceExit: true
    });

    registerRuntimeFaultHandlers({
      runtimeState,
      shutdown: (signal: string, options: Record<string, any> = {}) => shutdownRuntime({
        signal,
        server,
        overviewSocketServer,
        configCache,
        registry,
        discordClient,
        supervisor,
        queues,
        ...options
      })
    });

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    logger.info('✅ All systems ready!\n');
  } catch (error: any) {
    logger.error('❌ Startup failed:', error);
    process.exit(1);
  }
}

main();
