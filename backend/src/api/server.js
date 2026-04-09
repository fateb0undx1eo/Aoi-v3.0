import express from 'express';
import { logger } from '../utils/logger.js';
import { RepositoryError } from '../database/repository.js';
import { requireAuth } from './middleware/requireAuth.js';
import { createAuthRoutes } from './routes/authRoutes.js';
import { createDashboardRoutes } from './routes/dashboardRoutes.js';
import { createGuildRoutes } from './routes/guildRoutes.js';
import { createModuleRoutes } from './routes/moduleRoutes.js';
import { createAnalyticsRoutes } from './routes/analyticsRoutes.js';
import { createSettingsRoutes } from './routes/settingsRoutes.js';
import { createModerationRoutes } from './routes/moderationRoutes.js';

export function buildApiServer(deps) {
  const app = express();
  app.set('trust proxy', 1);
  const allowedOrigins = new Set(deps.env?.frontend?.corsAllowedOrigins ?? []);

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowAnyOrigin = allowedOrigins.size === 0;

    if (origin && (allowAnyOrigin || allowedOrigins.has(origin))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
    } else if (allowAnyOrigin) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,Cookie,x-user-id,x-user-role-ids');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.use(express.json());

  app.get('/healthz', (_req, res) => {
    res.status(200).json({ ok: true, service: 'discord-ecosystem-backend' });
  });

  app.use('/api/auth', createAuthRoutes(deps));
  app.use('/api/dashboard', createDashboardRoutes(deps));
  app.use('/api/guilds', createGuildRoutes(deps));
  app.use('/api/modules', createModuleRoutes(deps));
  app.use('/api/analytics', createAnalyticsRoutes(deps));
  app.use('/api/settings', createSettingsRoutes(deps));
  app.use('/api/moderation', requireAuth(deps.authService), createModerationRoutes(deps));

  app.use((error, _req, res, _next) => {
    logger.error('API error', error);

    if (error instanceof RepositoryError) {
      const details = String(error?.cause?.details || error?.cause?.message || error?.message || '');
      const isTransient =
        details.includes('fetch failed') ||
        details.includes('ECONNRESET') ||
        details.includes('ENOTFOUND') ||
        details.includes('ETIMEDOUT') ||
        details.includes('UND_ERR_CONNECT_TIMEOUT') ||
        details.includes('Connect Timeout Error');

      res.status(isTransient ? 503 : 500).json({
        error: isTransient ? 'config_store_unreachable' : 'config_store_failed'
      });
      return;
    }

    res.status(500).json({ error: 'internal_server_error' });
  });

  return app;
}
