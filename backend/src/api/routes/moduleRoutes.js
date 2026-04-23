import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireGuildAccess } from '../middleware/requireGuildAccess.js';

export function createModuleRoutes({ moduleService, configService, configCache, accessControlService, authService, roleColorRotationService, memeService, botLooksService, staffListService, dashboardOverviewService }) {
  const router = Router();
  router.use(requireAuth(authService));
  router.use('/:guildId', requireGuildAccess(accessControlService));

  router.get('/:guildId', async (req, res, next) => {
    try {
      const modules = moduleService.listModules(req.params.guildId);
      res.status(200).json({ modules });
    } catch (error) {
      next(error);
    }
  });

  router.put('/:guildId/:moduleName', async (req, res, next) => {
    try {
      const guildId = req.params.guildId;
      const moduleName = req.params.moduleName;
      await configService.upsertModuleConfig({
        guild_id: guildId,
        module_name: moduleName,
        enabled: req.body.enabled ?? true,
        config: req.body.config ?? {}
      });
      await configCache.refreshGuild(guildId);
      dashboardOverviewService?.invalidateGuild(guildId);
      if (moduleName === 'community' && roleColorRotationService) {
        await roleColorRotationService.syncGuild(guildId);
      }
      if (moduleName === 'community' && memeService) {
        await memeService.syncGuild(guildId);
      }
      if (moduleName === 'community' && botLooksService) {
        await botLooksService.syncGuild(guildId);
      }
      if (moduleName === 'tools' && staffListService && req.body?.config?.staff_list) {
        await staffListService.syncGuild(guildId, {
          publishNow: true,
          forceNewMessage: req.body.config.staff_list.update_mode !== 'edit_existing'
        });
      }
      res.status(200).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
