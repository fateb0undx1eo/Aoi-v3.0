import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireGuildAccess } from '../middleware/requireGuildAccess.js';
import type { AuthService } from '../../services/authService.js';
import type { AccessControlService } from '../../services/accessControlService.js';
import type { DashboardOverviewService } from '../../services/dashboardOverviewService.js';

interface Deps {
  authService: AuthService;
  accessControlService: AccessControlService;
  dashboardOverviewService: DashboardOverviewService;
}

export async function dashboardRoutes(instance: FastifyInstance, opts: { deps: Deps }): Promise<void> {
  const { authService, accessControlService, dashboardOverviewService } = opts.deps;
  const authHook = requireAuth(authService);
  const guildAccessHook = requireGuildAccess(accessControlService);

  instance.get('/guild/:guildId/overview', { preHandler: [authHook, guildAccessHook] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const guildId = params.guildId!;
    const overview = await dashboardOverviewService.getOverview(guildId);
    if (!overview) {
      return reply.status(404).send({ error: 'Guild not found or bot not in guild' });
    }
    return reply.send(overview);
  });

  instance.post('/guild/:guildId/socket-ticket', { preHandler: [authHook, guildAccessHook] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const guildId = params.guildId!;
    const ticket = authService.createSocketTicket((request as any).auth, guildId);
    return reply.status(200).send({
      ticket,
      expires_in_ms: 60 * 1000
    });
  });

  instance.post('/guild/:guildId/logs-socket-ticket', { preHandler: [authHook, guildAccessHook] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const guildId = params.guildId!;
    const ticket = authService.createLogsSocketTicket((request as any).auth);
    return reply.status(200).send({
      ticket,
      expires_in_ms: 60 * 1000
    });
  });
}
