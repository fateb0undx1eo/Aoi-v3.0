import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireGuildAccess } from '../middleware/requireGuildAccess.js';

export function createAnalyticsRoutes({ analyticsService, accessControlService, authService }) {
  const router = Router();
  router.use(requireAuth(authService));
  router.use('/:guildId', requireGuildAccess(accessControlService));

  router.get('/:guildId', async (req, res, next) => {
    try {
      const points = await analyticsService.getLast30Days(req.params.guildId);
      res.status(200).json({ points });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
