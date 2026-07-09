import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireGuildAccess } from '../middleware/requireGuildAccess.js';
import type { AuthService } from '../../services/authService.js';
import type { AccessControlService } from '../../services/accessControlService.js';
import type { AnalyticsService } from '../../services/analyticsService.js';

interface Deps {
  analyticsService: AnalyticsService;
  accessControlService: AccessControlService;
  authService: AuthService;
}

export async function analyticsRoutes(instance: FastifyInstance, opts: { deps: Deps }): Promise<void> {
  const { analyticsService, accessControlService, authService } = opts.deps;
  const authHook = requireAuth(authService);
  const guildAccessHook = requireGuildAccess(accessControlService);

  instance.addHook('preHandler', authHook);
  instance.addHook('preHandler', guildAccessHook);

  instance.get('/:guildId', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const guildId = params.guildId!;
    const points = await analyticsService.getLast30Days(guildId);
    return reply.status(200).send({ points });
  });
}
