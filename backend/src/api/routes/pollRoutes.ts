import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireGuildAccess } from '../middleware/requireGuildAccess.js';
import { rateLimiter } from '../middleware/rateLimiter.js';
import { renderVsCard } from '../../services/pollCanvas.js';
import type { AuthService } from '../../services/authService.js';
import type { AccessControlService } from '../../services/accessControlService.js';
import type { VisualPollService } from '../../services/visualPollService.js';

interface Deps {
  authService: AuthService;
  accessControlService: AccessControlService;
  visualPollService: VisualPollService;
}

function sendError(reply: FastifyReply, status: number, error: string): FastifyReply {
  return reply.status(status).send({ error });
}

export async function pollRoutes(instance: FastifyInstance, opts: { deps: Deps }): Promise<void> {
  const { authService, accessControlService, visualPollService } = opts.deps;
  const authHook = requireAuth(authService);
  const guildAccessHook = requireGuildAccess(accessControlService);

  instance.addHook('preHandler', authHook);

  instance.get('/:guildId', { preHandler: guildAccessHook }, async (request: FastifyRequest, reply: FastifyReply) => {
    const guildId = String((request.params as Record<string, string>).guildId);
    const polls = await visualPollService.listPolls(guildId);
    return reply.status(200).send({ polls });
  });

  instance.get('/:guildId/:pollId', { preHandler: guildAccessHook }, async (request: FastifyRequest, reply: FastifyReply) => {
    const guildId = String((request.params as Record<string, string>).guildId);
    const pollId = String((request.params as Record<string, string>).pollId);
    const poll = await visualPollService.getPoll(pollId);
    if (!poll || poll.guild_id !== guildId) {
      return sendError(reply, 404, 'Poll not found');
    }
    const totals = await visualPollService.totals(poll);
    return reply.status(200).send({ poll, totals });
  });

  instance.post('/:guildId', { preHandler: [guildAccessHook, rateLimiter({ windowMs: 60_000, maxRequests: 10, keyPrefix: 'poll_create' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const guildId = String((request.params as Record<string, string>).guildId);
      const body = request.body as Record<string, any>;
      const channelId = String(body?.channel_id ?? '');
      const userId = String((request as any).user?.id ?? (request.headers['x-user-id'] ?? ''));

      if (!channelId) return sendError(reply, 400, 'Select a target channel');
      if (!userId) return sendError(reply, 401, 'Unknown user');

      const poll = await visualPollService.createPoll(guildId, channelId, {
        type: body?.type,
        title: body?.title,
        subtitle: body?.subtitle,
        instructions: body?.instructions,
        options: body?.options ?? [],
        settings: body?.settings ?? {},
      }, userId);

      return reply.status(200).send({ ok: true, poll });
    } catch (error: any) {
      return sendError(reply, 400, error instanceof Error ? error.message : 'Failed to create poll');
    }
  });

  instance.post('/:guildId/render', { preHandler: [guildAccessHook, rateLimiter({ windowMs: 60_000, maxRequests: 30, keyPrefix: 'poll_render' })] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as Record<string, any>;
      const options = Array.isArray(body?.options) ? body.options : [];
      if (options.length < 2) return sendError(reply, 400, 'At least 2 options are needed to render a VS card');

      const buffer = await renderVsCard(
        options.map((option: any) => ({
          imageUrl: option?.image_url ?? null,
          label: String(option?.label ?? ''),
        })),
        {
          badgeLabel: 'VS',
        }
      );

      return reply.status(200).send({
        ok: true,
        data: `data:image/png;base64,${buffer.toString('base64')}`,
        size: buffer.length,
      });
    } catch (error: any) {
      return sendError(reply, 500, error instanceof Error ? error.message : 'Failed to render VS card');
    }
  });

  instance.post('/:guildId/:pollId/votes', { preHandler: guildAccessHook }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const guildId = String((request.params as Record<string, string>).guildId);
      const pollId = String((request.params as Record<string, string>).pollId);
      const body = request.body as Record<string, any>;
      const userId = String((request as any).user?.id ?? (request.headers['x-user-id'] ?? ''));
      if (!userId) return sendError(reply, 401, 'Unknown user');

      const optionId = String(body?.option_id ?? '');
      if (!optionId) return sendError(reply, 400, 'Option id is required');

      const poll = await visualPollService.recordVote(pollId, guildId, userId, optionId);
      await visualPollService.refreshPollMessage(poll);
      const totals = await visualPollService.totals(poll);
      return reply.status(200).send({ ok: true, poll, totals });
    } catch (error: any) {
      return sendError(reply, 400, error instanceof Error ? error.message : 'Failed to record vote');
    }
  });

  instance.patch('/:guildId/:pollId', { preHandler: guildAccessHook }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const guildId = String((request.params as Record<string, string>).guildId);
      const pollId = String((request.params as Record<string, string>).pollId);
      const body = request.body as Record<string, any>;
      const status = String(body?.status ?? '');
      if (status !== 'open' && status !== 'closed') {
        return sendError(reply, 400, 'Status must be open or closed');
      }
      const poll = await visualPollService.setStatus(pollId, guildId, status);
      return reply.status(200).send({ ok: true, poll });
    } catch (error: any) {
      return sendError(reply, 400, error instanceof Error ? error.message : 'Failed to update poll');
    }
  });

  instance.delete('/:guildId/:pollId', { preHandler: guildAccessHook }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const guildId = String((request.params as Record<string, string>).guildId);
      const pollId = String((request.params as Record<string, string>).pollId);
      await visualPollService.deletePoll(pollId, guildId);
      return reply.status(200).send({ ok: true });
    } catch (error: any) {
      return sendError(reply, 400, error instanceof Error ? error.message : 'Failed to delete poll');
    }
  });
}