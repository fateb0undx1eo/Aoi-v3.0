import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Client } from 'discord.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireGuildAccess } from '../middleware/requireGuildAccess.js';
import { rateLimiter } from '../middleware/rateLimiter.js';
import type { AuthService } from '../../services/authService.js';
import type { AccessControlService } from '../../services/accessControlService.js';
import type { GuildService } from '../../services/guildService.js';
import type { DmBroadcastService } from '../../services/dmBroadcastService.js';
import type { AnnouncementService } from '../../services/announcementService.js';
import type { UploadService } from '../../services/upload/uploadService.js';
import { logger } from '../../utils/logger.js';

interface Deps {
  guildService: GuildService;
  accessControlService: AccessControlService;
  client: Client;
  authService: AuthService;
  dmBroadcastService: DmBroadcastService;
  announcementService: AnnouncementService;
  uploadService: UploadService;
}

export async function guildRoutes(instance: FastifyInstance, opts: { deps: Deps }): Promise<void> {
  const { guildService, accessControlService, client, authService, dmBroadcastService, announcementService, uploadService } = opts.deps;
  const authHook = requireAuth(authService);
  const guildAccessHook = requireGuildAccess(accessControlService);

  instance.addHook('preHandler', authHook);

  instance.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const guilds = await guildService.listGuilds();
    return reply.status(200).send({ guilds });
  });

  instance.get('/:guildId/overview', { preHandler: guildAccessHook }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const guildId = params.guildId!;
    const overview = await guildService.getOverview(guildId);
    return reply.status(200).send({ overview });
  });

  instance.get('/:guildId/channels', { preHandler: guildAccessHook }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const guildId = params.guildId!;
    const guild = client.guilds.cache.get(guildId);

    if (!guild) {
      return reply.status(404).send({ error: 'Guild not found' });
    }

    const channels = guild.channels.cache
      .filter((ch: any) => ch.type === 0)
      .map((ch: any) => ({
        id: ch.id,
        name: ch.name,
        type: ch.type
      }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name));

    return reply.status(200).send({ channels });
  });

  instance.get('/:guildId/roles', { preHandler: guildAccessHook }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const guildId = params.guildId!;
    const guild = client.guilds.cache.get(guildId);

    if (!guild) {
      return reply.status(404).send({ error: 'Guild not found' });
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

    return reply.status(200).send({ roles });
  });

  instance.get('/:guildId/emojis', { preHandler: guildAccessHook }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const guildId = params.guildId!;
    const guild = client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId).catch(() => null);

    if (!guild) {
      return reply.status(404).send({ error: 'Guild not found' });
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

    return reply.status(200).send({ emojis });
  });

  instance.get('/:guildId/members', { preHandler: guildAccessHook }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    const guildId = params.guildId!;
    const guild = client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId).catch(() => null);

    if (!guild) {
      return reply.status(404).send({ error: 'Guild not found' });
    }

    const q = String(query.q ?? '').trim().toLowerCase();
    const limit = Math.min(50, Math.max(1, Number.parseInt(String(query.limit ?? '25'), 10) || 25));

    const now = Date.now();
    const lastFetch = (guild as any)._lastMembersFetch || 0;
    if (guild.memberCount <= 1000 && guild.members.cache.size < guild.memberCount && now - lastFetch > 60000) {
      (guild as any)._lastMembersFetch = now;
      await guild.members.fetch().catch(() => null);
    }

    const members = guild.members.cache
      .filter((member: any) => !member.user?.bot)
      .filter((member: any) => {
        if (!q) return true;
        return member.user.username.toLowerCase().includes(q)
          || member.displayName.toLowerCase().includes(q)
          || member.id.includes(q);
      })
      .map((member: any) => ({
        id: member.id,
        username: member.user.username,
        display_name: member.displayName
      }))
      .sort((left: any, right: any) => left.display_name.localeCompare(right.display_name))
      .slice(0, limit);

    return reply.status(200).send({ members });
  });

  instance.post('/:guildId/dm-broadcast', { preHandler: guildAccessHook }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const guildId = params.guildId!;
    const job = await dmBroadcastService.startBroadcast(guildId, request.body ?? {});
    return reply.status(202).send({ ok: true, job });
  });

  instance.get('/:guildId/dm-broadcast/:jobId', { preHandler: guildAccessHook }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const guildId = params.guildId!;
    const jobId = params.jobId!;
    const job = dmBroadcastService.getJob(guildId, jobId);
    if (!job) {
      return reply.status(404).send({ error: 'dm_broadcast_job_not_found' });
    }
    return reply.status(200).send({ ok: true, job });
  });

  instance.post('/:guildId/upload', { preHandler: guildAccessHook }, async (request: FastifyRequest, reply: FastifyReply) => {
    const file = await request.file();
    if (!file) {
      return reply.status(400).send({ error: 'No file provided' });
    }

    const buffer = await file.toBuffer();
    const url = await uploadService.processFile({
      buffer,
      originalname: file.filename,
      mimetype: file.mimetype,
      size: buffer.length,
    });

    return reply.status(200).send({ url });
  });

  instance.post('/:guildId/announcements', { preHandler: [guildAccessHook, rateLimiter({ windowMs: 60_000, maxRequests: 10, keyPrefix: 'announcement_send' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as Record<string, string>;
      const guildId = params.guildId!;

      const body: Record<string, any> = {};
      const entryMetas: Record<string, any> = {};
      const entryBuffers: Record<string, { buffer: Buffer; filename: string; mimetype: string; size: number }[]> = {};

      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === 'file') {
          const fieldMatch = part.fieldname?.match(/^file_(.+)$/);
          if (fieldMatch) {
            const entryId = fieldMatch[1]!;
            if (!entryBuffers[entryId]) entryBuffers[entryId] = [];
            const buffer = await part.toBuffer();
            entryBuffers[entryId].push({
              buffer,
              filename: part.filename,
              mimetype: part.mimetype,
              size: buffer.length,
            });
          }
        } else {
          const metaMatch = part.fieldname.match(/^filemeta_(.+)$/);
          if (metaMatch) {
            try { entryMetas[metaMatch[1]!] = JSON.parse(part.value as string); } catch {}
          } else if (part.fieldname === 'payload') {
            try { Object.assign(body, JSON.parse(part.value as string)); } catch {}
          } else {
            body[part.fieldname] = part.value;
          }
        }
      }

      if (Object.keys(entryBuffers).length > 10) {
        return reply.status(400).send({ error: 'Maximum 10 files per announcement' });
      }

      logger.info({ guildId, filesCount: Object.keys(entryBuffers).length, bodyKeys: Object.keys(body) }, 'announcement upload received');

      body._entryFiles = {};
      for (const [entryId, metas] of Object.entries(entryMetas)) {
        const files = entryBuffers[entryId] || [];
        const metaArr = Array.isArray(metas) ? metas : [metas];
        body._entryFiles[entryId] = files.map((f, i) => ({
          buffer: f.buffer,
          originalname: (metaArr[i] as any)?.name || f.filename,
          mimetype: f.mimetype,
          size: f.size,
          spoiler: (metaArr[i] as any)?.spoiler || false,
          description: (metaArr[i] as any)?.description || undefined,
        }));
      }

      logger.info({ entryCount: Object.keys(body._entryFiles).length, channelCount: body.channel_ids?.length }, 'announcement payload assembled');
      const result = await announcementService.send(guildId, body);
      logger.info({ result }, 'announcement sent successfully');
      return reply.status(200).send({ ok: true, result });
    } catch (error) {
      logger.error({ err: error, guildId: (request.params as any).guildId }, 'announcement upload failed');
      if (error instanceof Error) {
        return reply.status(400).send({ error: error.message });
      }
      throw error;
    }
  });
}
