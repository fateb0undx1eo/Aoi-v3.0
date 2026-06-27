import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import type { Client } from 'discord.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireGuildAccess } from '../middleware/requireGuildAccess.js';
import { rateLimiter } from '../middleware/rateLimiter.js';
import type { BotContext } from '../../types/index.js';
import type { AuthService } from '../../services/authService.js';
import type { AccessControlService } from '../../services/accessControlService.js';
import type { GuildService } from '../../services/guildService.js';
import type { DmBroadcastService } from '../../services/dmBroadcastService.js';
import type { AnnouncementService } from '../../services/announcementService.js';
import { logger } from '../../utils/logger.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

export function createGuildRoutes({ guildService, accessControlService, client, authService, dmBroadcastService, announcementService }: {
  guildService: GuildService;
  accessControlService: AccessControlService;
  client: Client;
  authService: AuthService;
  dmBroadcastService: DmBroadcastService;
  announcementService: AnnouncementService;
}): Router {
  const router = Router();
  router.use(requireAuth(authService));

  router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const guilds = await guildService.listGuilds();
      res.status(200).json({ guilds });
    } catch (error) {
      next(error);
    }
  });

  router.use('/:guildId/*', requireGuildAccess(accessControlService));

  router.use('/:guildId/dm-broadcast', rateLimiter({ windowMs: 300_000, maxRequests: 5, keyPrefix: 'dm_broadcast' }));

  router.get('/:guildId/overview', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guildId = req.params.guildId as string;
      const overview = await guildService.getOverview(guildId);
      res.status(200).json({ overview });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:guildId/channels', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guildId = req.params.guildId as string;
      const guild = client.guilds.cache.get(guildId);

      if (!guild) {
        return res.status(404).json({ error: 'Guild not found' });
      }

      const channels = guild.channels.cache
        .filter((ch: any) => ch.type === 0)
        .map((ch: any) => ({
          id: ch.id,
          name: ch.name,
          type: ch.type
        }))
        .sort((a: any, b: any) => a.name.localeCompare(b.name));

      res.status(200).json({ channels });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:guildId/roles', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guildId = req.params.guildId as string;
      const guild = client.guilds.cache.get(guildId);

      if (!guild) {
        return res.status(404).json({ error: 'Guild not found' });
      }

      const roles = guild.roles.cache
        .filter((role: any) => role.id !== guild.id)
        .map((role: any) => ({
          id: role.id,
          name: role.name,
          color: role.color,
          managed: role.managed,
          editable: role.editable,
          position: role.position
        }))
        .sort((left: any, right: any) => right.position - left.position);

      res.status(200).json({ roles });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:guildId/emojis', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guildId = req.params.guildId as string;
      const guild = client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId).catch(() => null);

      if (!guild) {
        return res.status(404).json({ error: 'Guild not found' });
      }

      const now = Date.now();
      const lastFetch = (guild as any)._lastEmojisFetch || 0;
      if (now - lastFetch > 120000) {
        (guild as any)._lastEmojisFetch = now;
        await guild.emojis.fetch().catch(() => {});
      }

      const emojis = guild.emojis.cache
        .map((emoji: any) => ({
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

  router.get('/:guildId/members', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guildId = req.params.guildId as string;
      const guild = client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId).catch(() => null);

      if (!guild) {
        return res.status(404).json({ error: 'Guild not found' });
      }

      const query = String(req.query.q ?? '').trim().toLowerCase();
      const limit = Math.min(50, Math.max(1, Number.parseInt(String(req.query.limit ?? '25'), 10) || 25));

      const now = Date.now();
      const lastFetch = (guild as any)._lastMembersFetch || 0;
      if (guild.memberCount <= 1000 && guild.members.cache.size < guild.memberCount && now - lastFetch > 60000) {
        (guild as any)._lastMembersFetch = now;
        await guild.members.fetch().catch(() => null);
      }

      const members = guild.members.cache
        .filter((member: any) => !member.user?.bot)
        .filter((member: any) => {
          if (!query) return true;

          return member.user.username.toLowerCase().includes(query)
            || member.displayName.toLowerCase().includes(query)
            || member.id.includes(query);
        })
        .map((member: any) => ({
          id: member.id,
          username: member.user.username,
          display_name: member.displayName
        }))
        .sort((left: any, right: any) => left.display_name.localeCompare(right.display_name))
        .slice(0, limit);

      res.status(200).json({ members });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:guildId/dm-broadcast', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guildId = req.params.guildId as string;
      const job = await dmBroadcastService.startBroadcast(guildId, req.body ?? {});
      res.status(202).json({ ok: true, job });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:guildId/dm-broadcast/:jobId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guildId = req.params.guildId as string;
      const jobId = req.params.jobId as string;
      const job = dmBroadcastService.getJob(guildId, jobId);
      if (!job) {
        return res.status(404).json({ error: 'dm_broadcast_job_not_found' });
      }

      res.status(200).json({ ok: true, job });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:guildId/announcements', upload.any(), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guildId = req.params.guildId as string;
      logger.info({ guildId, filesCount: (req.files as any[])?.length ?? 0, bodyKeys: Object.keys(req.body ?? {}) }, 'announcement upload received');
      let payload: Record<string, any> = req.body ?? {};
      if ((req.body as Record<string, any>)?.payload) {
        try { payload = JSON.parse((req.body as Record<string, any>).payload); } catch { payload = {}; }
      }
      interface EntryMeta {
        name?: string;
        spoiler?: boolean;
        description?: string;
      }
      interface FileEntry {
        fieldname?: string;
        originalname: string;
        mimetype: string;
        size: number;
        buffer: Buffer;
      }
      const entryMetas: Record<string, EntryMeta | EntryMeta[]> = {};
      const entryBuffers: Record<string, FileEntry[]> = {};
      const bodyKeys = Object.keys(req.body ?? {});
      for (const key of bodyKeys) {
        const metaMatch = key.match(/^filemeta_(.+)$/);
        if (metaMatch) {
          const entryId = metaMatch[1] as string;
          try { entryMetas[entryId] = JSON.parse((req.body as Record<string, any>)[key]); } catch {}
        }
      }
      for (const f of (req.files as FileEntry[]) || []) {
        const fieldMatch = f.fieldname?.match(/^file_(.+)$/);
        if (fieldMatch) {
          const entryId = fieldMatch[1] as string;
          if (!entryBuffers[entryId]) entryBuffers[entryId] = [];
          entryBuffers[entryId].push(f);
        }
      }
      payload._entryFiles = {};
      for (const [entryId, metas] of Object.entries(entryMetas)) {
        const files = entryBuffers[entryId] || [];
        const metaArr = Array.isArray(metas) ? metas : [metas];
        payload._entryFiles[entryId] = files.map((f: FileEntry, i: number) => ({
          buffer: f.buffer,
          originalname: (metaArr[i] as EntryMeta)?.name || f.originalname,
          mimetype: f.mimetype,
          size: f.size,
          spoiler: (metaArr[i] as EntryMeta)?.spoiler || false,
          description: (metaArr[i] as EntryMeta)?.description || undefined,
        }));
      }
      logger.info({ entryCount: Object.keys(payload._entryFiles).length, channelCount: payload.channel_ids?.length }, 'announcement payload assembled');
      const result = await announcementService.send(guildId, payload);
      logger.info({ result }, 'announcement sent successfully');
      res.status(200).json({ ok: true, result });
    } catch (error) {
      logger.error({ err: error, guildId: req.params.guildId }, 'announcement upload failed');
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  return router;
}
