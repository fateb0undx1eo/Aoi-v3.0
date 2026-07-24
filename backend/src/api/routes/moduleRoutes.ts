import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireGuildAccess } from '../middleware/requireGuildAccess.js';
import { debounce } from '../../core/cache/layeredCache.js';
import type { ConfigCache } from '../../types/index.js';
import type { AuthService } from '../../services/authService.js';
import type { AccessControlService } from '../../services/accessControlService.js';
import type { ModuleService } from '../../services/moduleService.js';
import type { ConfigService } from '../../services/configService.js';
import type { DashboardOverviewService } from '../../services/dashboardOverviewService.js';
import type { RoleColorRotationService } from '../../services/roleColorRotationService.js';
import type { StaffListService } from '../../services/staffListService.js';
import type { ProfileStyleService } from '../../services/profileStyleService.js';

interface MemeServiceLike {
  syncGuild(guildId: string): Promise<any>;
}

interface BotLooksServiceLike {
  syncGuild(guildId: string): Promise<void>;
}

interface Deps {
  moduleService: ModuleService;
  configService: ConfigService;
  configCache: ConfigCache;
  accessControlService: AccessControlService;
  authService: AuthService;
  roleColorRotationService?: RoleColorRotationService;
  memeService?: MemeServiceLike;
  botLooksService?: BotLooksServiceLike;
  staffListService?: StaffListService;
  dashboardOverviewService?: DashboardOverviewService;
  profileStyleService?: ProfileStyleService;
}

export async function moduleRoutes(instance: FastifyInstance, opts: { deps: Deps }): Promise<void> {
  const {
    moduleService, configService, configCache, accessControlService, authService,
    roleColorRotationService, memeService, botLooksService, staffListService,
    dashboardOverviewService, profileStyleService
  } = opts.deps;
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
    const modules = moduleService.listModules(guildId);
    return reply.status(200).send({ modules });
  });

  instance.get('/:guildId/:moduleName', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const guildId = params.guildId!;
    const moduleName = params.moduleName!;
    const moduleConfig = await configService.getModuleConfig(guildId, moduleName).catch(() => null);
    return reply.status(200).send({
      module: moduleConfig ?? {
        guild_id: guildId,
        module_name: moduleName,
        enabled: true,
        config: {}
      }
    });
  });

  instance.put('/:guildId/:moduleName', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const guildId = params.guildId!;
    const moduleName = params.moduleName!;
    const body = request.body as Record<string, any>;
    await configService.upsertModuleConfig({
      guild_id: guildId,
      module_name: moduleName,
      enabled: body.enabled ?? true,
      config: body.config ?? {}
    });
    getRefresh(guildId)();
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
    if (moduleName === 'community' && profileStyleService) {
      await profileStyleService.syncGuild(guildId);
    }
    if (moduleName === 'tools' && staffListService && body?.config?.staff_list) {
      await staffListService.syncGuild(guildId, {
        publishNow: true,
        forceNewMessage: body.config.staff_list.update_mode !== 'edit_existing'
      });
    }
    return reply.status(200).send({ ok: true });
  });

  // ── Command-level config endpoints ───────────────────────────

  instance.get('/:guildId/commands', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const guildId = params.guildId!;
    const modules = moduleService.listModulesWithCommands(guildId);
    return reply.status(200).send({ modules });
  });

  instance.get('/:guildId/:moduleName/commands', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const guildId = params.guildId!;
    const moduleName = params.moduleName!;
    const modules = moduleService.listModulesWithCommands(guildId);
    const mod = modules.find((m: any) => m.name === moduleName);
    if (!mod) {
      return reply.status(404).send({ error: 'module_not_found' });
    }
    return reply.status(200).send({ module: mod });
  });

  instance.put('/:guildId/:moduleName/commands/:commandName', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const guildId = params.guildId!;
    const commandName = params.commandName!;
    const body = request.body as Record<string, any>;
    await configService.upsertCommandConfig({
      guild_id: guildId,
      command_name: commandName,
      enabled: body.enabled ?? true,
      overrides: body.overrides ?? null,
    });
    getRefresh(guildId)();
    return reply.status(200).send({ ok: true });
  });
}
