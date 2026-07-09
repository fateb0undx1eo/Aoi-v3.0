import type { FastifyRequest, FastifyReply } from 'fastify';

interface AccessControlServiceForMiddleware {
  canAccessGuild(guildId: string, userId: string, roleIds: string[]): Promise<boolean>;
}

export function requireGuildAccess(accessControlService: AccessControlServiceForMiddleware) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      if (
        process.env.NODE_ENV === 'development' &&
        String(process.env.DASHBOARD_DEV_BYPASS || '').toLowerCase() === 'true'
      ) {
        return;
      }

      const params = request.params as Record<string, string>;
      const query = request.query as Record<string, string>;
      const guildId = params.guildId ?? query.guildId ?? '';
      const userId = (request as any).user?.id ?? request.headers['x-user-id']?.toString();
      const rawRolesHeader = request.headers['x-user-role-ids'];
      const rawRoles = Array.isArray(rawRolesHeader) ? rawRolesHeader.join(',') : (rawRolesHeader ?? '');
      const roleIds = rawRoles
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

      if (!guildId || !userId) {
        reply.status(401).send({ error: 'missing_identity_headers' });
        return;
      }

      const allowed = await accessControlService.canAccessGuild(guildId, userId, roleIds);
      if (!allowed) {
        reply.status(403).send({ error: 'guild_access_denied' });
        return;
      }
    } catch (error) {
      throw error;
    }
  };
}
