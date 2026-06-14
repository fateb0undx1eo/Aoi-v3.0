import 'express-async-errors';
import os from 'node:os';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import express, { type Request, type Response, type NextFunction } from 'express';
import compression from 'compression';
import timeout from 'connect-timeout';
import { createRequestId, logger, withLogContext } from '../utils/logger.js';
import { RepositoryError } from '../database/repository.js';
import { ExternalServiceUnavailableError, ValidationError, UnauthorizedError } from '../errors.js';
import { metrics } from '../observability/metrics.js';
import { runtimeState } from '../observability/runtimeState.js';
import type { EnvConfig } from '../types/env.js';
import { requireAuth } from './middleware/requireAuth.js';
import { idempotency } from './middleware/idempotency.js';
import { createAuthRoutes } from './routes/authRoutes.js';
import { createDashboardRoutes } from './routes/dashboardRoutes.js';
import { createGuildRoutes } from './routes/guildRoutes.js';
import { createModuleRoutes } from './routes/moduleRoutes.js';
import { createAnalyticsRoutes } from './routes/analyticsRoutes.js';
import { createSettingsRoutes } from './routes/settingsRoutes.js';
import { createModerationRoutes } from './routes/moderationRoutes.js';

interface ApiServerDependencies {
  authService: any;
  env: EnvConfig;
  discordClient?: { isReady?(): boolean };
  redis?: { isReady?(): boolean };
  websocketStats?: () => { connections: number };
  queueStats?: () => Array<{ name: string; size: number; active: number; failed: number }>;
  [key: string]: any;
}

function validateDeps(deps: ApiServerDependencies): void {
  if (!deps.authService) throw new Error('authService required');
  if (!deps.env) throw new Error('env required');
}

export function buildApiServer(deps: any): express.Application {
  validateDeps(deps);

  const eventLoopHistogram = monitorEventLoopDelay();
  eventLoopHistogram.enable();

  const app = express();
  app.set('trust proxy', 1);
  app.set('etag', 'strong');
  app.use(compression({ level: 6, threshold: 512 }));
  const allowedOrigins = new Set(deps.env?.frontend?.corsAllowedOrigins ?? []);
  const allowAnyOrigin = allowedOrigins.size === 0 && deps.env?.nodeEnv !== 'production';

  app.use((req: Request, res: Response, next: NextFunction): void => {
    const requestId = req.headers['x-request-id']?.toString() || createRequestId();
    const startedAt = Date.now();
    res.setHeader('x-request-id', requestId);
    res.on('finish', () => {
      metrics.increment('http_requests_total', { method: req.method, status: res.statusCode });
      metrics.observe('http_request_duration_ms', Date.now() - startedAt, {
        method: req.method,
        route: req.route?.path || req.path
      });
    });
    withLogContext({ request_id: requestId }, next);
  });

  app.use((req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;

    if (origin && (allowAnyOrigin || allowedOrigins.has(origin))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
    } else if (allowAnyOrigin) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,Cookie,x-user-id,x-user-role-ids,Idempotency-Key');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.use(express.json({ limit: '1mb' }));
  app.use(timeout('30s'));

  app.get('/healthz', (_req: Request, res: Response): void => {
    const mem = process.memoryUsage();
    const cpu = process.cpuUsage();
    res.status(200).json({
      ok: true,
      service: 'discord-ecosystem-backend',
      discord_ready: deps.discordClient?.isReady?.() ?? false,
      redis_ready: deps.redis?.isReady?.() ?? false,
      system: {
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        os_uptime_seconds: Math.round(os.uptime()),
        loadavg: os.loadavg(),
        total_memory_mb: Math.round(os.totalmem() / 1024 / 1024),
        free_memory_mb: Math.round(os.freemem() / 1024 / 1024),
        cpus: os.cpus().length
      },
      event_loop_lag_ms: {
        min: eventLoopHistogram.min,
        max: eventLoopHistogram.max,
        mean: eventLoopHistogram.mean,
        stddev: eventLoopHistogram.stddev,
        p50: eventLoopHistogram.percentile(50),
        p95: eventLoopHistogram.percentile(95),
        p99: eventLoopHistogram.percentile(99)
      },
      process: {
        pid: process.pid,
        uptime_seconds: Math.round(process.uptime()),
        memory: {
          rss_mb: Math.round(mem.rss / 1024 / 1024),
          heap_total_mb: Math.round(mem.heapTotal / 1024 / 1024),
          heap_used_mb: Math.round(mem.heapUsed / 1024 / 1024),
          external_mb: Math.round(mem.external / 1024 / 1024),
          array_buffers_mb: Math.round(mem.arrayBuffers / 1024 / 1024)
        },
        cpu: {
          user_ms: Math.round(cpu.user / 1000),
          system_ms: Math.round(cpu.system / 1000)
        }
      },
      runtime: runtimeState.snapshot()
    });
  });

  app.get('/metrics', (_req: Request, res: Response): void => {
    res.status(200).json(metrics.snapshot({
      runtime: runtimeState.snapshot(),
      websocket: deps.websocketStats?.() ?? null,
      queues: deps.queueStats?.() ?? []
    }));
  });

  app.use('/api/auth', idempotency, createAuthRoutes(deps));
  app.use('/api/dashboard', idempotency, createDashboardRoutes(deps));
  app.use('/api/guilds', idempotency, createGuildRoutes(deps));
  app.use('/api/modules', idempotency, createModuleRoutes(deps));
  app.use('/api/analytics', idempotency, createAnalyticsRoutes(deps));
  app.use('/api/settings', idempotency, createSettingsRoutes(deps));
  app.use('/api/moderation', requireAuth(deps.authService), idempotency, createModerationRoutes(deps));

  app.use((error: Error, _req: Request, res: Response, _next: NextFunction): void => {
    logger.error('API error', error);

    if (error instanceof ExternalServiceUnavailableError) {
      res.status(503).json({ error: 'config_store_unreachable' });
      return;
    }

    if (error instanceof ValidationError) {
      res.status(400).json({ error: 'validation_error' });
      return;
    }

    if (error instanceof UnauthorizedError) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    if (error instanceof RepositoryError) {
      res.status(500).json({ error: 'config_store_failed' });
      return;
    }

    res.status(500).json({ error: 'internal_server_error' });
  });

  return app;
}
