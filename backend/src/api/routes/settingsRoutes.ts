import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireGuildAccess } from '../middleware/requireGuildAccess.js';
import { debounce } from '../../core/cache/layeredCache.js';
import type { BotContext } from '../../types/index.js';
import type { ConfigCache } from '../../types/index.js';
import type { AuthService } from '../../services/authService.js';
import type { AccessControlService } from '../../services/accessControlService.js';
import type { ConfigService } from '../../services/configService.js';
import type { SettingsService } from '../../services/settingsService.js';

export function createSettingsRoutes({ authService, configService, configCache, settingsService, accessControlService }: {
  authService: AuthService;
  configService: ConfigService;
  configCache: ConfigCache;
  settingsService: SettingsService;
  accessControlService: AccessControlService;
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
      const settings = await settingsService.getGuildSettings(guildId);
      const logs = await configService.getLogsConfig(guildId).catch(() => []);
      res.status(200).json({ settings: { ...settings, logs } });
    } catch (error) {
      next(error);
    }
  });

  router.put('/:guildId/prefix', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guildId = req.params.guildId as string;
      const prefix = String((req.body as Record<string, any>).prefix ?? '!').trim();
      if (!prefix || prefix.length > 8) {
        res.status(400).json({ error: 'invalid_prefix' });
        return;
      }
      await settingsService.setPrefix(guildId, prefix);
      res.status(200).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.put('/:guildId/branding', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guildId = req.params.guildId as string;
      await settingsService.setBranding(guildId, (req.body as Record<string, any>).branding ?? {});
      res.status(200).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.put('/:guildId/dashboard-roles', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guildId = req.params.guildId as string;
      await settingsService.setDashboardRoles(guildId, (req.body as Record<string, any>).roleIds ?? []);
      getRefresh(guildId)();
      res.status(200).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.put('/:guildId/error-logs', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guildId = req.params.guildId as string;
      const body = req.body as Record<string, any>;
      const channelId = String(body.channelId ?? '').trim();
      const enabled = Boolean(body.enabled);
      if (enabled && !channelId) {
        res.status(400).json({ error: 'missing_error_log_channel' });
        return;
      }

      await configService.upsertLogsConfig({
        guild_id: guildId,
        event_name: 'error',
        channel_id: channelId || null,
        enabled
      });
      getRefresh(guildId)();
      res.status(200).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.put('/:guildId/commands/:commandName', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guildId = req.params.guildId as string;
      const commandName = req.params.commandName as string;
      const body = req.body as Record<string, any>;
      await configService.upsertCommandConfig({
        guild_id: guildId,
        command_name: commandName,
        enabled: body.enabled ?? true,
        overrides: body.overrides ?? {}
      });
      getRefresh(guildId)();
      res.status(200).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
