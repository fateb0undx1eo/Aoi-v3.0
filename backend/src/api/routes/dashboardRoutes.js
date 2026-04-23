import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireGuildAccess } from '../middleware/requireGuildAccess.js';

export function createDashboardRoutes(deps) {
  const router = Router();
  const { authService, accessControlService, dashboardOverviewService } = deps;

  router.use(requireAuth(authService));

  router.get('/guild/:guildId/overview', requireGuildAccess(accessControlService), async (req, res, next) => {
    try {
      const { guildId } = req.params;
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

  router.post('/guild/:guildId/socket-ticket', requireGuildAccess(accessControlService), async (req, res, next) => {
    try {
      const { guildId } = req.params;
      const ticket = authService.createSocketTicket(req.auth, guildId);
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
