import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireGuildAccess } from '../middleware/requireGuildAccess.js';
import type { BotContext } from '../../types/index.js';
import type { AuthService } from '../../services/authService.js';
import type { AccessControlService } from '../../services/accessControlService.js';
import type { DashboardOverviewService } from '../../services/dashboardOverviewService.js';

export function createDashboardRoutes({ authService, accessControlService, dashboardOverviewService }: {
  authService: AuthService;
  accessControlService: AccessControlService;
  dashboardOverviewService: DashboardOverviewService;
}): Router {
  const router = Router();

  router.use(requireAuth(authService));

  router.get('/guild/:guildId/overview', requireGuildAccess(accessControlService), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guildId = req.params.guildId as string;
      const overview = await dashboardOverviewService.getOverview(guildId);
      if (!overview) {
        res.status(404).json({ error: 'Guild not found or bot not in guild' });
        return;
      }

      res.json(overview);
    } catch (error) {
      next(error);
    }
  });

  router.post('/guild/:guildId/socket-ticket', requireGuildAccess(accessControlService), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guildId = req.params.guildId as string;
      const ticket = authService.createSocketTicket(req.auth as any, guildId);
      res.status(200).json({
        ticket,
        expires_in_ms: 60 * 1000
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/guild/:guildId/logs-socket-ticket', requireGuildAccess(accessControlService), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ticket = authService.createLogsSocketTicket(req.auth as any);
      res.status(200).json({
        ticket,
        expires_in_ms: 60 * 1000
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
