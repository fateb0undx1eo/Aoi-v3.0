import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireGuildAccess } from '../middleware/requireGuildAccess.js';

// Cache for guild member counts (5 minute TTL)
const memberCountCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedMemberCounts(guildId) {
  const cached = memberCountCache.get(guildId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

function setCachedMemberCounts(guildId, data) {
  memberCountCache.set(guildId, { data, timestamp: Date.now() });
}

export function createDashboardRoutes(deps) {
  const router = Router();
  const { authService, client, moduleService, accessControlService } = deps;

  router.use(requireAuth(authService));

  router.get('/guild/:guildId/overview', requireGuildAccess(accessControlService), async (req, res, next) => {
    try {
      const { guildId } = req.params;

      // Get guild from Discord client (which is in context)
      const guild = client?.guilds?.cache?.get(guildId);
      
      if (!guild) {
        return res.status(404).json({ error: 'Guild not found or bot not in guild' });
      }

      // Get member counts with caching to avoid rate limits
      let memberCounts = getCachedMemberCounts(guildId);
      
      if (!memberCounts) {
        try {
          const members = await guild.members.fetch();
          memberCounts = {
            humans: members.filter(m => !m.user.bot).size,
            bots: members.filter(m => m.user.bot).size,
            total: members.size
          };
          setCachedMemberCounts(guildId, memberCounts);
        } catch (fetchError) {
          // Fallback to guild.memberCount if fetch fails (rate limit)
          memberCounts = {
            humans: guild.memberCount || 0,
            bots: 0,
            total: guild.memberCount || 0
          };
        }
      }
      
      // Get boost info
      const boostCount = guild.premiumSubscriptionCount || 0;
      const boostTier = guild.premiumTier || 0;

      // Build stats
      const stats = {
        roles_count: guild.roles.cache.size,
        channels_count: guild.channels.cache.size,
        emojis_count: guild.emojis.cache.size,
        stickers_count: guild.stickers?.cache?.size || 0,
      };

      // Build analytics entry
      const analytics = [{
        date: new Date().toISOString().split('T')[0],
        member_count: memberCounts.total,
        human_count: memberCounts.humans,
        bot_count: memberCounts.bots,
      }];

      const modules = moduleService.listModules(guildId);

      res.json({
        guild: {
          id: guild.id,
          name: guild.name,
          icon: guild.icon,
          owner_id: guild.ownerId,
          member_count: guild.memberCount || memberCounts.total,
          premium_subscription_count: boostCount,
          premium_tier: boostTier,
        },
        stats,
        analytics,
        modules,
        refreshed_at: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
