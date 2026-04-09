export function requireGuildAccess(accessControlService) {
  return async (req, res, next) => {
    try {
      if (
        process.env.NODE_ENV === 'development' &&
        String(process.env.DASHBOARD_DEV_BYPASS || '').toLowerCase() === 'true'
      ) {
        next();
        return;
      }

      const guildId = req.params.guildId ?? req.query.guildId;
      const userId = req.user?.id ?? req.header('x-user-id');
      const rawRoles = req.header('x-user-role-ids') ?? '';
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
