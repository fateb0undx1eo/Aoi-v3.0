import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireGuildAccess } from '../middleware/requireGuildAccess.js';

export function createGuildRoutes({ guildService, accessControlService, client, authService, dmBroadcastService, announcementService }) {
  const router = Router();
  router.use(requireAuth(authService));

  router.get('/', async (_req, res, next) => {
    try {
      const guilds = await guildService.listGuilds();
      res.status(200).json({ guilds });
    } catch (error) {
      next(error);
    }
  });

  router.use('/:guildId/*', requireGuildAccess(accessControlService));

  router.get('/:guildId/overview', async (req, res, next) => {
    try {
      const overview = await guildService.getOverview(req.params.guildId);
      res.status(200).json({ overview });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:guildId/channels', async (req, res, next) => {
    try {
      const { guildId } = req.params;
      const guild = client.guilds.cache.get(guildId);
      
      if (!guild) {
        return res.status(404).json({ error: 'Guild not found' });
      }

      const channels = guild.channels.cache
        .filter(ch => ch.type === 0) // Text channels only
        .map(ch => ({
          id: ch.id,
          name: ch.name,
          type: ch.type
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      res.status(200).json({ channels });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:guildId/roles', async (req, res, next) => {
    try {
      const { guildId } = req.params;
      const guild = client.guilds.cache.get(guildId);

      if (!guild) {
        return res.status(404).json({ error: 'Guild not found' });
      }

      const roles = guild.roles.cache
        .filter((role) => role.id !== guild.id)
        .map((role) => ({
          id: role.id,
          name: role.name,
          color: role.color,
          managed: role.managed,
          editable: role.editable,
          position: role.position
        }))
        .sort((left, right) => right.position - left.position);

      res.status(200).json({ roles });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:guildId/emojis', async (req, res, next) => {
    try {
      const { guildId } = req.params;
      const guild = client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId).catch(() => null);

      if (!guild) {
        return res.status(404).json({ error: 'Guild not found' });
      }

      const emojis = guild.emojis.cache
        .map((emoji) => ({
          id: emoji.id,
          name: emoji.name,
          animated: emoji.animated,
          mention: emoji.animated ? `<a:${emoji.name}:${emoji.id}>` : `<:${emoji.name}:${emoji.id}>`,
          url: emoji.imageURL({ extension: emoji.animated ? 'gif' : 'png', size: 64 })
        }));

      res.status(200).json({ emojis });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:guildId/members', async (req, res, next) => {
    try {
      const { guildId } = req.params;
      const guild = client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId).catch(() => null);

      if (!guild) {
        return res.status(404).json({ error: 'Guild not found' });
      }

      const query = String(req.query.q ?? '').trim().toLowerCase();
      const limit = Math.min(50, Math.max(1, Number.parseInt(String(req.query.limit ?? '25'), 10) || 25));

      if (guild.memberCount <= 1000 && guild.members.cache.size < guild.memberCount) {
        await guild.members.fetch().catch(() => null);
      }

      const members = guild.members.cache
        .filter((member) => !member.user?.bot)
        .filter((member) => {
          if (!query) return true;

          return member.user.username.toLowerCase().includes(query)
            || member.displayName.toLowerCase().includes(query)
            || member.id.includes(query);
        })
        .map((member) => ({
          id: member.id,
          username: member.user.username,
          display_name: member.displayName
        }))
        .sort((left, right) => left.display_name.localeCompare(right.display_name))
        .slice(0, limit);

      res.status(200).json({ members });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:guildId/dm-broadcast', async (req, res, next) => {
    try {
      const job = await dmBroadcastService.startBroadcast(req.params.guildId, req.body ?? {});
      res.status(202).json({ ok: true, job });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:guildId/dm-broadcast/:jobId', async (req, res, next) => {
    try {
      const job = dmBroadcastService.getJob(req.params.guildId, req.params.jobId);
      if (!job) {
        return res.status(404).json({ error: 'dm_broadcast_job_not_found' });
      }

      res.status(200).json({ ok: true, job });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:guildId/announcements', async (req, res, next) => {
    try {
      const result = await announcementService.send(req.params.guildId, req.body ?? {});
      res.status(200).json({ ok: true, result });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
