import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { VisualPollService } from '../../services/visualPollService.js';

interface Deps {
  visualPollService: VisualPollService;
}

export async function pollDevRoutes(instance: FastifyInstance, opts: { deps: Deps }): Promise<void> {
  const { visualPollService } = opts.deps;

  instance.post('/dev/send', async (request: FastifyRequest, reply: FastifyReply) => {
    if (process.env.NODE_ENV === 'production') {
      return reply.status(404).send({ error: 'not_found' });
    }
    try {
      const body = request.body as Record<string, any>;
      const channelId = String(body?.channelId ?? '');
      const draft = body?.draft as any;
      if (!channelId) return reply.status(400).send({ error: 'channelId required' });
      if (!draft || typeof draft !== 'object') return reply.status(400).send({ error: 'draft required' });
      const poll = await visualPollService.sendDevPoll(channelId, draft);
      return reply.status(200).send({ ok: true, poll });
    } catch (error: any) {
      return reply.status(400).send({ error: error instanceof Error ? error.message : 'Failed to send dev poll' });
    }
  });
}
