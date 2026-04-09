import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireGuildAccess } from '../middleware/requireGuildAccess.js';

export function createSettingsRoutes({ authService, configService, configCache, settingsService, accessControlService }) {
  const router = Router();
  router.use(requireAuth(authService));
  router.use('/:guildId', requireGuildAccess(accessControlService));

  router.get('/:guildId', async (req, res, next) => {
    try {
      const settings = await settingsService.getGuildSettings(req.params.guildId);
      res.status(200).json({ settings });
    } catch (error) {
      next(error);
    }
  });

  router.put('/:guildId/prefix', async (req, res, next) => {
    try {
      await settingsService.setPrefix(req.params.guildId, req.body.prefix ?? '!');
      res.status(200).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.put('/:guildId/branding', async (req, res, next) => {
    try {
      await settingsService.setBranding(req.params.guildId, req.body.branding ?? {});
      res.status(200).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.put('/:guildId/dashboard-roles', async (req, res, next) => {
    try {
      await settingsService.setDashboardRoles(req.params.guildId, req.body.roleIds ?? []);
      await configCache.refreshGuild(req.params.guildId);
      res.status(200).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.put('/:guildId/commands/:commandName', async (req, res, next) => {
    try {
      const guildId = req.params.guildId;
      await configService.upsertCommandConfig({
        guild_id: guildId,
        command_name: req.params.commandName,
        enabled: req.body.enabled ?? true,
        overrides: req.body.overrides ?? {}
      });
      await configCache.refreshGuild(guildId);
      res.status(200).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
