import os from 'node:os';
import http from 'node:http';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import Fastify, { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import compress from '@fastify/compress';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { createRequestId, logger, withLogContext } from '../utils/logger.js';
import { RepositoryError } from '../database/repository.js';
import { ExternalServiceUnavailableError, ValidationError, UnauthorizedError } from '../errors.js';
import { metrics } from '../observability/metrics.js';
import { runtimeState } from '../observability/runtimeState.js';
import type { EnvConfig } from '../types/env.js';
import { idempotencyPreHandler, idempotencyOnSend } from './middleware/idempotency.js';
import { requireAuth } from './middleware/requireAuth.js';
import { authRoutes } from './routes/authRoutes.js';
import { dashboardRoutes } from './routes/dashboardRoutes.js';
import { guildRoutes } from './routes/guildRoutes.js';
import { moduleRoutes } from './routes/moduleRoutes.js';
import { analyticsRoutes } from './routes/analyticsRoutes.js';
import { settingsRoutes } from './routes/settingsRoutes.js';
import { moderationRoutes } from './routes/moderationRoutes.js';
import { presetRoutes } from './routes/presetRoutes.js';

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

export interface BuildResult {
  fastify: FastifyInstance;
  server: http.Server;
}

export function buildApiServer(deps: any): BuildResult {
  validateDeps(deps);

  const eventLoopHistogram = monitorEventLoopDelay();
  eventLoopHistogram.enable();

  const server = http.createServer();

  const fastify = Fastify({
    serverFactory: (handler) => {
      server.on('request', handler);
      return server;
    },
    trustProxy: 1,
    bodyLimit: 1048576,
    requestTimeout: 30000,
  });

  const allowedOrigins = new Set<string>(deps.env?.frontend?.corsAllowedOrigins ?? []);
  const allowAnyOrigin = deps.env?.nodeEnv !== 'production';

  fastify.register(compress, { global: true, threshold: 512 });

  fastify.register(cors, {
    origin: allowAnyOrigin ? true : Array.from(allowedOrigins),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'x-user-id', 'x-user-role-ids', 'Idempotency-Key'],
  });

  fastify.register(multipart, { limits: { fileSize: 200 * 1024 * 1024 } });

  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const requestId = request.headers['x-request-id']?.toString() || createRequestId();
    (request as any).startedAt = Date.now();
    reply.header('x-request-id', requestId);
    withLogContext({ request_id: requestId }, () => {});
  });

  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const startedAt = (request as any).startedAt || Date.now();
    metrics.increment('http_requests_total', { method: request.method, status: reply.statusCode });
    metrics.observe('http_request_duration_ms', Date.now() - startedAt, {
      method: request.method,
      route: request.routeOptions?.url || request.url
    });
  });

  fastify.get('/healthz', async (request: FastifyRequest, reply: FastifyReply) => {
    const mem = process.memoryUsage();
    const cpu = process.cpuUsage();
    return reply.status(200).send({
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

  fastify.get('/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send(metrics.snapshot({
      runtime: runtimeState.snapshot(),
      websocket: deps.websocketStats?.() ?? null,
      queues: deps.queueStats?.() ?? []
    }));
  });

  fastify.setErrorHandler((error: Error, request: FastifyRequest, reply: FastifyReply) => {
    logger.error('API error', error);

    if (error instanceof ExternalServiceUnavailableError) {
      return reply.status(503).send({ error: 'config_store_unreachable' });
    }

    if (error instanceof ValidationError) {
      return reply.status(400).send({ error: 'validation_error' });
    }

    if (error instanceof UnauthorizedError) {
      return reply.status(401).send({ error: 'unauthorized' });
    }

    if (error instanceof RepositoryError) {
      return reply.status(500).send({ error: 'config_store_failed' });
    }

    if ((error as any).statusCode) {
      return reply.status((error as any).statusCode).send({ error: error.message });
    }

    return reply.status(500).send({ error: 'internal_server_error' });
  });

  function registerGroup(prefix: string, routeFn: any, extraHooks: any[] = []) {
    fastify.register(async (instance: FastifyInstance) => {
      instance.addHook('preHandler', idempotencyPreHandler);
      instance.addHook('onSend', idempotencyOnSend);
      for (const hook of extraHooks) {
        instance.addHook('preHandler', hook);
      }
      instance.register(routeFn, { deps });
    }, { prefix });
  }

  registerGroup('/api/auth', authRoutes);
  registerGroup('/api/dashboard', dashboardRoutes);
  registerGroup('/api/guilds', guildRoutes);
  registerGroup('/api/modules', moduleRoutes);
  registerGroup('/api/analytics', analyticsRoutes);
  registerGroup('/api/settings', settingsRoutes);
  registerGroup('/api/moderation', moderationRoutes, [requireAuth(deps.authService)]);
  registerGroup('/api/modules', presetRoutes);

  return { fastify, server };
}
