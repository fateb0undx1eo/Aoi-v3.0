import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireGuildAccess } from '../middleware/requireGuildAccess.js';
import { debounce } from '../../core/cache/layeredCache.js';
import type { ConfigCache } from '../../types/index.js';
import type { AuthService } from '../../services/authService.js';
import type { AccessControlService } from '../../services/accessControlService.js';
import type { ConfigService } from '../../services/configService.js';
import type { SettingsService } from '../../services/settingsService.js';

interface Deps {
  authService: AuthService;
  configService: ConfigService;
  configCache: ConfigCache;
  settingsService: SettingsService;
  accessControlService: AccessControlService;
}

export async function settingsRoutes(instance: FastifyInstance, opts: { deps: Deps }): Promise<void> {
  const { authService, configService, configCache, settingsService, accessControlService } = opts.deps;
  const authHook = requireAuth(authService);
  const guildAccessHook = requireGuildAccess(accessControlService);

  instance.addHook('preHandler', authHook);
  instance.addHook('preHandler', guildAccessHook);

  const refreshFns = new Map<string, (...args: any[]) => void>();

  function getRefresh(guildId: string): (...args: any[]) => void {
    let fn = refreshFns.get(guildId);
    if (!fn) {
      fn = debounce((id: string) => configCache.refreshGuild(id), 2000, `refresh:${guildId}`);
      refreshFns.set(guildId, fn);
    }
    return fn;
  }

  instance.get('/:guildId', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const guildId = params.guildId!;
    const settings = await settingsService.getGuildSettings(guildId);
    const logs = await configService.getLogsConfig(guildId).catch(() => []);
    return reply.status(200).send({ settings: { ...settings, logs } });
  });

  instance.put('/:guildId/prefix', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const guildId = params.guildId!;
    const body = request.body as Record<string, any>;
    const prefix = String(body.prefix ?? '!').trim();
    if (!prefix || prefix.length > 8) {
      return reply.status(400).send({ error: 'invalid_prefix' });
    }
    await settingsService.setPrefix(guildId, prefix);
    return reply.status(200).send({ ok: true });
  });

  instance.put('/:guildId/branding', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const guildId = params.guildId!;
    const body = request.body as Record<string, any>;
    await settingsService.setBranding(guildId, body.branding ?? {});
    return reply.status(200).send({ ok: true });
  });

  instance.put('/:guildId/dashboard-roles', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const guildId = params.guildId!;
    const body = request.body as Record<string, any>;
    await settingsService.setDashboardRoles(guildId, body.roleIds ?? []);
    getRefresh(guildId)();
    return reply.status(200).send({ ok: true });
  });

  instance.put('/:guildId/error-logs', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const guildId = params.guildId!;
    const body = request.body as Record<string, any>;
    const channelId = String(body.channelId ?? '').trim();
    const enabled = Boolean(body.enabled);
    if (enabled && !channelId) {
      return reply.status(400).send({ error: 'missing_error_log_channel' });
    }

    await configService.upsertLogsConfig({
      guild_id: guildId,
      event_name: 'error',
      channel_id: channelId || null,
      enabled
    });
    getRefresh(guildId)();
    return reply.status(200).send({ ok: true });
  });

  instance.put('/:guildId/commands/:commandName', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const guildId = params.guildId!;
    const commandName = params.commandName!;
    const body = request.body as Record<string, any>;
    await configService.upsertCommandConfig({
      guild_id: guildId,
      command_name: commandName,
      enabled: body.enabled ?? true,
      overrides: body.overrides ?? {}
    });
    getRefresh(guildId)();
    return reply.status(200).send({ ok: true });
  });
}
