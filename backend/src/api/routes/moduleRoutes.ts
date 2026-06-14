import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireGuildAccess } from '../middleware/requireGuildAccess.js';
import { debounce } from '../../core/cache/layeredCache.js';
import type { BotContext } from '../../types/index.js';
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

export function createModuleRoutes({
  moduleService, configService, configCache, accessControlService, authService,
  roleColorRotationService, memeService, botLooksService, staffListService,
  dashboardOverviewService, profileStyleService
}: {
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
}): Router {
  const router = Router();
  router.use(requireAuth(authService));
  router.use('/:guildId', requireGuildAccess(accessControlService));

  const refreshFns = new Map<string, (...args: any[]) => void>();
  function getRefresh(guildId: string): (...args: any[]) => void {
    let fn = refreshFns.get(guildId);
    if (!fn) {
      fn = debounce((id: string) => configCache.refreshGuild(id), 2000, `refresh:${guildId}`);
      refreshFns.set(guildId, fn);
    }
    return fn;
  }

  router.get('/:guildId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guildId = req.params.guildId as string;
      const modules = moduleService.listModules(guildId);
      res.status(200).json({ modules });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:guildId/:moduleName', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guildId = req.params.guildId as string;
      const moduleName = req.params.moduleName as string;
      const moduleConfig = await configService.getModuleConfig(guildId, moduleName).catch(() => null);
      res.status(200).json({
        module: moduleConfig ?? {
          guild_id: guildId,
          module_name: moduleName,
          enabled: true,
          config: {}
        }
      });
    } catch (error) {
      next(error);
    }
  });

  router.put('/:guildId/:moduleName', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guildId = req.params.guildId as string;
      const moduleName = req.params.moduleName as string;
      const body = req.body as Record<string, any>;
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
      res.status(200).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
