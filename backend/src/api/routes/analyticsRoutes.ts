import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireGuildAccess } from '../middleware/requireGuildAccess.js';
import type { BotContext } from '../../types/index.js';
import type { AuthService } from '../../services/authService.js';
import type { AccessControlService } from '../../services/accessControlService.js';
import type { AnalyticsService } from '../../services/analyticsService.js';

export function createAnalyticsRoutes({ analyticsService, accessControlService, authService }: {
  analyticsService: AnalyticsService;
  accessControlService: AccessControlService;
  authService: AuthService;
}): Router {
  const router = Router();
  router.use(requireAuth(authService));
  router.use('/:guildId', requireGuildAccess(accessControlService));

  router.get('/:guildId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guildId = req.params.guildId as string;
      const points = await analyticsService.getLast30Days(guildId);
      res.status(200).json({ points });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
