import { logger } from '../../utils/logger.js';

interface ModuleConfigRow {
  guild_id: string;
  module_name: string;
  enabled: boolean;
  config: Record<string, any>;
  updated_at: string;
}

interface CommandConfigRow {
  guild_id: string;
  command_name: string;
  enabled: boolean;
  overrides: Record<string, any> | null;
  updated_at: string;
}

interface WelcomeConfig {
  is_enabled?: boolean;
  config_json?: {
    enabled?: boolean;
    channel_id?: string;
    message?: string;
    dm?: boolean;
    dm_message?: string;
    [key: string]: any;
  };
}

interface ConfigServiceLike {
  getGuildModuleConfigs(guildId: string): Promise<ModuleConfigRow[]>;
  getGuildCommandConfigs(guildId: string): Promise<CommandConfigRow[]>;
  getWelcomeConfig(guildId: string): Promise<WelcomeConfig | null>;
}

interface CacheStats {
  moduleCache: number;
  commandCache: number;
  welcomeCache: number;
  refreshMs: number;
}

export class ConfigCache {
  private configService: ConfigServiceLike;
  private refreshMs: number;
  private moduleCache: Map<string, ModuleConfigRow>;
  private commandCache: Map<string, CommandConfigRow>;
  private welcomeCache: Map<string, WelcomeConfig>;
  private timer: ReturnType<typeof setInterval> | null;
  private failureCooldownMs: number;
  private lastFailureLogAt: Map<string, number>;

  constructor(configService: ConfigServiceLike, refreshMs: number = 30000) {
    this.configService = configService;
    this.refreshMs = refreshMs;
    this.moduleCache = new Map();
    this.commandCache = new Map();
    this.welcomeCache = new Map();
    this.timer = null;
    this.failureCooldownMs = 5 * 60 * 1000;
    this.lastFailureLogAt = new Map();
  }

  private _key(guildId: string, name: string): string {
    return `${guildId}:${name}`;
  }

  private _failureKey(guildId: string, scope: string): string {
    return `${guildId}:${scope}`;
  }

  private _shouldLogFailure(guildId: string, scope: string): boolean {
    const key = this._failureKey(guildId, scope);
    const last = this.lastFailureLogAt.get(key) ?? 0;
    const now = Date.now();
    if (now - last < this.failureCooldownMs) {
      return false;
    }

    this.lastFailureLogAt.set(key, now);
    return true;
  }

  private _logWarmFailure(guildId: string, scope: string, error: any): void {
    if (!this._shouldLogFailure(guildId, scope)) {
      return;
    }

    const details = this._formatErrorDetails(error);
    logger.warn(`Failed to refresh ${scope} cache for guild ${guildId}: ${details}`);
  }

  private _formatErrorDetails(error: any): string {
    const details = String(error?.cause?.details || error?.cause?.message || error?.message || 'unknown error');
    const compactLine = details
      .split('\n')
      .map((line: string) => line.trim())
      .find((line: string) => line && !line.startsWith('at '));

    return compactLine || 'unknown error';
  }

  async warmGuild(guildId: string): Promise<void> {
    const [modulesResult, commandsResult, welcomeResult] = await Promise.allSettled([
      this.configService.getGuildModuleConfigs(guildId),
      this.configService.getGuildCommandConfigs(guildId),
      this.configService.getWelcomeConfig(guildId)
    ]);

    if (modulesResult.status === 'fulfilled') {
      for (const row of modulesResult.value) {
        this.moduleCache.set(this._key(guildId, row.module_name), row);
      }
    } else {
      this._logWarmFailure(guildId, 'module', modulesResult.reason);
    }

    if (commandsResult.status === 'fulfilled') {
      for (const row of commandsResult.value) {
        this.commandCache.set(this._key(guildId, row.command_name), row);
      }
    } else {
      this._logWarmFailure(guildId, 'command', commandsResult.reason);
    }

    if (welcomeResult.status === 'fulfilled') {
      if (welcomeResult.value) {
        this.welcomeCache.set(guildId, welcomeResult.value);
      }
    } else {
      this._logWarmFailure(guildId, 'welcome', welcomeResult.reason);
    }
  }

  async refreshGuild(guildId: string): Promise<void> {
    try {
      await this.warmGuild(guildId);
      logger.debug(`Refreshed config cache for guild ${guildId}`);
    } catch (error: any) {
      const details = this._formatErrorDetails(error);
      if (this._shouldLogFailure(guildId, 'refresh')) {
        logger.warn(`Failed to refresh cache for guild ${guildId}: ${details}`);
      }
    }
  }

  startAutoRefresh(guildProvider: () => string[]): void {
    if (this.timer) return;
    this.timer = setInterval(async () => {
      try {
        const guildIds = await guildProvider();
        await Promise.all(guildIds.map((id) => this.refreshGuild(id)));
      } catch (error) {
        logger.warn('Config cache auto-refresh cycle failed', error);
      }
    }, this.refreshMs);
  }

  stopAutoRefresh(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getModuleConfig(guildId: string, moduleName: string): ModuleConfigRow | null {
    return this.moduleCache.get(this._key(guildId, moduleName)) ?? null;
  }

  getCommandConfig(guildId: string, commandName: string): CommandConfigRow | null {
    return this.commandCache.get(this._key(guildId, commandName)) ?? null;
  }

  getWelcomeConfig(guildId: string): Record<string, any> | null {
    const cached = this.welcomeCache.get(guildId);
    if (!cached) return null;

    return {
      enabled: cached.is_enabled && (cached.config_json?.enabled ?? false),
      channel_id: cached.config_json?.channel_id || null,
      message: cached.config_json?.message || 'Welcome {user} to {server}!',
      dm: cached.config_json?.dm || false,
      dm_message: cached.config_json?.dm_message || null,
      config: cached.config_json || {}
    };
  }

  invalidate(guildId: string, module: string, feature: string | null = null): void {
    if (module === 'welcome') {
      this.welcomeCache.delete(guildId);
      logger.debug(`Invalidated Welcome cache for ${guildId}`);
    }
  }

  invalidateGuild(guildId: string): void {
    this.welcomeCache.delete(guildId);
    logger.debug(`Invalidated all caches for guild ${guildId}`);
  }

  getStats(): CacheStats {
    return {
      moduleCache: this.moduleCache.size,
      commandCache: this.commandCache.size,
      welcomeCache: this.welcomeCache.size,
      refreshMs: this.refreshMs
    };
  }
}
