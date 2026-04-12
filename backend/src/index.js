import { buildApiServer } from './api/server.js';
import { env } from './core/config/env.js';
import { createDiscordClient } from './core/discordClient.js';
import { bootstrapRegistry } from './core/loader/bootstrap.js';
import { registerEventDispatcher } from './events/dispatcher.js';
import { registerInteractionRouter } from './interactions/interactionRouter.js';
import { logger } from './utils/logger.js';
import { ConfigService } from './services/configService.js';
import { ConfigCache } from './core/configCache/configCache.js';
import { PermissionService } from './core/permissions/permissionService.js';
import { RateLimitService } from './services/rateLimitService.js';
import { DynamicRateLimiter } from './core/rateLimiter/dynamicRateLimiter.js';
import { PlaceholderEngine } from './core/placeholderEngine/placeholderEngine.js';
import { GuildService } from './services/guildService.js';
import { AnalyticsService } from './services/analyticsService.js';
import { StaffRatingService } from './services/staffRatingService.js';
import { ModuleService } from './services/moduleService.js';
import { AuthService } from './services/authService.js';
import { SettingsService } from './services/settingsService.js';
import { ToolsService } from './services/toolsService.js';
import { MemeService } from './services/memeService.js';
import { CommunityService } from './services/communityService.js';
import { ModerationService } from './services/moderationService.js';
import { DiscordCommandSyncService } from './services/discordCommandSyncService.js';
import { AccessControlService } from './services/accessControlService.js';
import { RoleColorRotationService } from './services/roleColorRotationService.js';
import { BotLooksService } from './services/botLooksService.js';
import { StaffListService } from './services/staffListService.js';
import { DmBroadcastService } from './services/dmBroadcastService.js';
import { AnnouncementService } from './services/announcementService.js';

async function main() {
  const registry = await bootstrapRegistry();
  const client = createDiscordClient();

  const configService = new ConfigService();
  const configCache = new ConfigCache(configService);
  const permissionService = new PermissionService();
  const rateLimitService = new RateLimitService();
  const rateLimiter = new DynamicRateLimiter(rateLimitService);
  const placeholderEngine = new PlaceholderEngine();
  const guildService = new GuildService();
  const analyticsService = new AnalyticsService();
  const staffRatingService = new StaffRatingService();
  const moduleService = new ModuleService(registry, configCache);
  const authService = new AuthService(env);
  const settingsService = new SettingsService(configService);
  const toolsService = new ToolsService();
  const memeService = new MemeService({
    configService,
    configCache,
    client,
    env
  });
  const communityService = new CommunityService(configService, staffRatingService);
  const moderationService = new ModerationService(configService);
  const commandSyncService = new DiscordCommandSyncService(env, registry);
  const accessControlService = new AccessControlService({
    client
  });
  const roleColorRotationService = new RoleColorRotationService({
    client,
    configService,
    configCache
  });
  const botLooksService = new BotLooksService({
    client,
    configService,
    configCache,
    preferredGuildId: env.discord.guildId
  });
  const staffListService = new StaffListService({
    client,
    configService,
    configCache
  });
  const dmBroadcastService = new DmBroadcastService({
    client,
    placeholderEngine
  });
  const announcementService = new AnnouncementService({
    client
  });

  const services = {
    authService,
    analyticsService,
    communityService,
    configService,
    guildService,
    memeService,
    moderationService,
    moduleService,
    roleColorRotationService,
    botLooksService,
    staffListService,
    settingsService,
    staffRatingService,
    dmBroadcastService,
    announcementService,
    toolsService,
    accessControlService
  };

  const context = {
    services,
    configCache,
    permissionService,
    placeholderEngine,
    rateLimiter,
    client
  };

  registerEventDispatcher(client, registry, context);
  registerInteractionRouter(client, registry, context);

  client.once('clientReady', async (readyClient) => {
    try {
      logger.info(`Discord client ready as ${readyClient.user.tag}`);
      if (env.discord.guildId) {
        try {
          await configCache.warmGuild(env.discord.guildId);
        } catch (error) {
          logger.warn('Config cache warm failed. Apply latest migration to fix.', error);
        }

        try {
          await rateLimiter.warmGuild(env.discord.guildId);
        } catch (error) {
          logger.warn('Rate limiter warm failed. Apply latest migration to fix.', error);
        }

        const guild = readyClient.guilds.cache.get(env.discord.guildId);
        if (guild) {
          try {
            await guildService.upsertGuildSnapshot(guild);
            await analyticsService.recordDaily(guild.id, {
              member_count: guild.memberCount,
              boost_level: guild.premiumTier,
              roles_count: guild.roles.cache.size,
              emojis_count: guild.emojis.cache.size,
              channels_count: guild.channels.cache.size
            });
          } catch (error) {
            logger.warn('Guild snapshot/analytics write failed. Apply latest migration to fix.', error);
          }
        }
      }

      try {
        const guildIds = readyClient.guilds.cache.map((guild) => guild.id);
        await roleColorRotationService.restoreAll(guildIds);
      } catch (error) {
        logger.warn('Role color rotation restore failed', error);
      }

      try {
        const guildIds = readyClient.guilds.cache.map((guild) => guild.id);
        await memeService.restoreAll(guildIds);
      } catch (error) {
        logger.warn('Meme autopost restore failed', error);
      }

      try {
        const guildIds = readyClient.guilds.cache.map((guild) => guild.id);
        await botLooksService.restoreAll(guildIds);
      } catch (error) {
        logger.warn('Bot looks restore failed', error);
      }

      try {
        const guildIds = readyClient.guilds.cache.map((guild) => guild.id);
        await staffListService.restoreAll(guildIds);
      } catch (error) {
        logger.warn('Staff list restore failed', error);
      }

      try {
        await commandSyncService.syncGuildCommands();
        logger.info(`Synced ${registry.commands.size} slash commands.`);
      } catch (error) {
        logger.warn('Command sync failed', error);
      }
    } catch (error) {
      logger.error('Unhandled error in ready lifecycle', error);
    }
  });

  await client.login(env.discord.token);

  configCache.startAutoRefresh(async () => client.guilds.cache.map((guild) => guild.id));

  setInterval(async () => {
    try {
      await analyticsService.cleanupOlderThan30Days();
      if (!env.discord.guildId) return;
      const guild = client.guilds.cache.get(env.discord.guildId);
      if (!guild) return;
      await analyticsService.recordDaily(guild.id, {
        member_count: guild.memberCount,
        boost_level: guild.premiumTier,
        roles_count: guild.roles.cache.size,
        emojis_count: guild.emojis.cache.size,
        channels_count: guild.channels.cache.size
      });
    } catch (error) {
      logger.warn('Analytics cleanup interval failed', error);
    }
  }, 24 * 60 * 60 * 1000);

  const apiServer = buildApiServer({
    env,
    client,
    authService,
    analyticsService,
    configCache,
    configService,
    guildService,
    dmBroadcastService,
    announcementService,
    memeService,
    moderationService,
    moduleService,
    roleColorRotationService,
    botLooksService,
    staffListService,
    settingsService,
    accessControlService
  });

  apiServer.listen(env.apiPort, () => {
    logger.info(`API server running on :${env.apiPort}`);
  });
}

main().catch((error) => {
  logger.error('Fatal bootstrap error', error);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled promise rejection', error);
});
