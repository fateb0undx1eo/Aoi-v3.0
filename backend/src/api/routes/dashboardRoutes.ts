import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
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

  router.get('/guild/:guildId/logs-history', requireGuildAccess(accessControlService), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const logDir = process.env.LOG_DIR || join(process.cwd(), 'logs');
      const logFile = join(logDir, 'app.log');
      if (!existsSync(logFile)) {
        res.json({ entries: [], total: 0, page: 1, limit: 50, totalPages: 0 });
        return;
      }

      const raw = readFileSync(logFile, 'utf-8');
      const lines = raw.trim().split('\n').filter(Boolean);

      const levels = req.query.level ? (req.query.level as string).split(',').filter(Boolean) : [];
      const q = (req.query.q as string || '').toLowerCase();
      const from = req.query.from as string | undefined;
      const to = req.query.to as string | undefined;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));

      const entries: any[] = [];
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (levels.length > 0 && !levels.includes(entry.level)) continue;
          if (q) {
            const match = entry.message?.toLowerCase().includes(q) ||
              JSON.stringify(entry.meta || {}).toLowerCase().includes(q) ||
              JSON.stringify(entry.context || {}).toLowerCase().includes(q);
            if (!match) continue;
          }
          if (from && new Date(entry.timestamp) < new Date(from)) continue;
          if (to && new Date(entry.timestamp) > new Date(to)) continue;
          entries.push(entry);
        } catch { }
      }

      entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      const total = entries.length;
      const totalPages = Math.ceil(total / limit);
      const start = (page - 1) * limit;
      const paged = entries.slice(start, start + limit);

      res.json({ entries: paged, total, page, limit, totalPages });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
