import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Client } from 'discord.js';
import { requireGuildAccess } from '../middleware/requireGuildAccess.js';
import { rateLimiter } from '../middleware/rateLimiter.js';
import { logger } from '../../utils/logger.js';
import type { AccessControlService } from '../../services/accessControlService.js';
import type { ModerationService } from '../../services/moderationService.js';

interface Deps {
  moderationService: ModerationService;
  accessControlService: AccessControlService;
  client: Client;
}

export async function moderationRoutes(instance: FastifyInstance, opts: { deps: Deps }): Promise<void> {
  const { moderationService, accessControlService, client } = opts.deps;
  const guildAccessHook = requireGuildAccess(accessControlService);

  instance.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ ok: true, service: 'moderation' });
  });

  instance.get('/:guildId/config', { preHandler: guildAccessHook }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const guildId = params.guildId!;
    const config = await moderationService.getModConfig(guildId);
    return reply.status(200).send({ config });
  });

  instance.put('/:guildId/config', { preHandler: guildAccessHook }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const guildId = params.guildId!;
    await moderationService.updateModConfig(guildId, request.body as Record<string, any>);
    return reply.status(200).send({ ok: true });
  });

  instance.get('/:guildId/cases', { preHandler: [guildAccessHook, rateLimiter({ windowMs: 60_000, maxRequests: 20, keyPrefix: 'mod_cases' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    const guildId = params.guildId!;
    const userId = query.userId;
    const type = query.type;
    const active = query.active;
    const limit = query.limit ?? '50';
    const offset = query.offset ?? '0';
    const cases = await moderationService.listCases(guildId, {
      userId,
      type,
      active: active === 'true',
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10)
    });
    return reply.status(200).send({ cases });
  });

  instance.post('/:guildId/cases', { preHandler: guildAccessHook }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const body = request.body as Record<string, any>;
    const { targetUserId, type, reason, durationSeconds } = body;
    const moderatorId = (request as any).user?.id;
    if (!moderatorId) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }
    const guildId = params.guildId!;

    const guild = client?.guilds?.cache?.get(guildId);
    let targetUsername = 'Unknown';
    let moderatorUsername = 'Unknown';

    if (!guild) {
      return reply.status(404).send({ error: 'Guild not found' });
    }

    try {
      const targetMember = await guild.members.fetch(targetUserId);
      targetUsername = targetMember.user.tag;
    } catch {}
    try {
      const modMember = await guild.members.fetch(moderatorId);
      moderatorUsername = modMember.user.tag;
    } catch {}

    try {
      const member = await guild.members.fetch(targetUserId);
      switch (type) {
        case 'WARN':
          try {
            await member.send(`⚠️ **Warning** from ${guild.name}\nReason: ${reason || 'No reason provided'}`);
          } catch {}
          break;
        case 'KICK':
          await member.kick(reason || 'Kicked by moderator');
          break;
        case 'BAN':
          await member.ban({ reason: reason || 'Banned by moderator', deleteMessageSeconds: 0 });
          break;
        case 'TIMEOUT':
          if (durationSeconds) {
            await member.timeout(durationSeconds * 1000, reason || 'Timed out by moderator');
          }
          break;
        case 'TEMPBAN':
          await member.ban({ reason: reason || 'Temp banned by moderator', deleteMessageSeconds: 0 });
          break;
      }
    } catch (punishError) {
      logger.warn({ err: punishError }, 'Failed to execute Discord punishment');
    }

    const caseData = await moderationService.createCase({
      guildId,
      targetUserId,
      targetUsername,
      moderatorUserId: moderatorId,
      moderatorUsername,
      type,
      reason,
      durationSeconds
    });

    return reply.status(201).send({ case: caseData });
  });

  instance.patch('/:guildId/cases/:caseId', { preHandler: guildAccessHook }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const body = request.body as Record<string, any>;
    const guildId = params.guildId!;
    const caseId = params.caseId!;
    const { reason, active } = body;
    await moderationService.updateCase(guildId, caseId, { reason, active });
    return reply.status(200).send({ ok: true });
  });

  instance.delete('/:guildId/cases/:caseId', { preHandler: guildAccessHook }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const guildId = params.guildId!;
    const caseId = params.caseId!;
    await moderationService.deleteCase(guildId, caseId);
    return reply.status(200).send({ ok: true });
  });

  instance.get('/:guildId/active', { preHandler: guildAccessHook }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const guildId = params.guildId!;
    const active = await moderationService.getActivePunishments(guildId);
    return reply.status(200).send({ active });
  });

  instance.post('/:guildId/revoke', { preHandler: [guildAccessHook, rateLimiter({ windowMs: 60_000, maxRequests: 10, keyPrefix: 'mod_revoke' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const body = request.body as Record<string, any>;
    const guildId = params.guildId!;
    const { caseId, reason } = body;
    const moderatorId = (request as any).user?.id;
    if (!moderatorId) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }

    await moderationService.revokePunishment({
      guildId,
      caseId,
      moderatorUserId: moderatorId,
      reason
    });

    return reply.status(200).send({ ok: true });
  });

  instance.get('/:guildId/warns/:userId', { preHandler: guildAccessHook }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const guildId = params.guildId!;
    const userId = params.userId!;
    const count = await moderationService.getWarnCount(guildId, userId);
    return reply.status(200).send({ count, userId });
  });

  instance.delete('/:guildId/warns/:userId', { preHandler: guildAccessHook }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const body = request.body as Record<string, any>;
    const guildId = params.guildId!;
    const userId = params.userId!;
    const moderatorId = (request as any).user?.id;
    if (!moderatorId) {
      return reply.status(401).send({ error: 'Not authenticated' });
    }
    await moderationService.clearWarns(guildId, userId, moderatorId);
    return reply.status(200).send({ ok: true });
  });
}
