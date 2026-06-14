import type { Request, Response, NextFunction } from 'express';

interface AccessControlServiceForMiddleware {
  canAccessGuild(guildId: string, userId: string, roleIds: string[]): Promise<boolean>;
}

export function requireGuildAccess(accessControlService: AccessControlServiceForMiddleware) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (
        process.env.NODE_ENV === 'development' &&
        String(process.env.DASHBOARD_DEV_BYPASS || '').toLowerCase() === 'true'
      ) {
        next();
        return;
      }

      const guildId = (req.params.guildId ?? req.query.guildId ?? '') as string;
      const userId = (req as Record<string, any>).user?.id ?? req.header('x-user-id')?.toString();
      const rawRolesHeader = req.header('x-user-role-ids');
      const rawRoles = Array.isArray(rawRolesHeader) ? rawRolesHeader.join(',') : (rawRolesHeader ?? '');
      const roleIds = rawRoles
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

      if (!guildId || !userId) {
        res.status(401).json({ error: 'missing_identity_headers' });
        return;
      }

      const allowed = await accessControlService.canAccessGuild(guildId, userId, roleIds);
      if (!allowed) {
        res.status(403).json({ error: 'guild_access_denied' });
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
