import { logger } from '../../utils/logger.js';

export class ConfigCache {
  constructor(configService, refreshMs = 30000) {
    this.configService = configService;
    this.refreshMs = refreshMs;
    this.moduleCache = new Map();
    this.commandCache = new Map();
    this.welcomeCache = new Map();      // guildId -> welcome config
    this.timer = null;
    this.failureCooldownMs = 5 * 60 * 1000;
    this.lastFailureLogAt = new Map();
  }

  _key(guildId, name) {
    return `${guildId}:${name}`;
  }

  _failureKey(guildId, scope) {
    return `${guildId}:${scope}`;
  }

  _shouldLogFailure(guildId, scope) {
    const key = this._failureKey(guildId, scope);
    const last = this.lastFailureLogAt.get(key) ?? 0;
    const now = Date.now();
    if (now - last < this.failureCooldownMs) {
      return false;
    }

    this.lastFailureLogAt.set(key, now);
    return true;
  }

  _logWarmFailure(guildId, scope, error) {
    if (!this._shouldLogFailure(guildId, scope)) {
      return;
    }

    const details = this._formatErrorDetails(error);
    logger.warn(`Failed to refresh ${scope} cache for guild ${guildId}: ${details}`);
  }

  _formatErrorDetails(error) {
    const details = String(error?.cause?.details || error?.cause?.message || error?.message || 'unknown error');
    const compactLine = details
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith('at '));

    return compactLine || 'unknown error';
  }

  async warmGuild(guildId) {
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

  async refreshGuild(guildId) {
    try {
      await this.warmGuild(guildId);
      logger.debug(`Refreshed config cache for guild ${guildId}`);
    } catch (error) {
      const details = this._formatErrorDetails(error);
      if (this._shouldLogFailure(guildId, 'refresh')) {
        logger.warn(`Failed to refresh cache for guild ${guildId}: ${details}`);
      }
    }
  }

  startAutoRefresh(guildProvider) {
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

  stopAutoRefresh() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getModuleConfig(guildId, moduleName) {
    return this.moduleCache.get(this._key(guildId, moduleName)) ?? null;
  }

  getCommandConfig(guildId, commandName) {
    return this.commandCache.get(this._key(guildId, commandName)) ?? null;
  }

  // ============================================
  // NEW METHODS for unified config system
  // ============================================

  /**
   * Get Welcome config (ZERO DB QUERY - cached)
   * @param {string} guildId
   * @returns {Object|null}
   */
  getWelcomeConfig(guildId) {
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

  /**
   * Invalidate a specific cache entry (call when config changes via dashboard)
   * @param {string} guildId
   * @param {string} module - 'welcome'
   * @param {string} feature - specific feature name
   */
  invalidate(guildId, module, feature = null) {
    if (module === 'welcome') {
      this.welcomeCache.delete(guildId);
      logger.debug(`Invalidated Welcome cache for ${guildId}`);
    }
  }

  /**
   * Invalidate all caches for a guild
   * @param {string} guildId
   */
  invalidateGuild(guildId) {
    // Clear all entries for this guild from all caches
    this.welcomeCache.delete(guildId);
    logger.debug(`Invalidated all caches for guild ${guildId}`);
  }

  /**
   * Get cache statistics for monitoring
   */
  getStats() {
    return {
      moduleCache: this.moduleCache.size,
      commandCache: this.commandCache.size,
      welcomeCache: this.welcomeCache.size,
      refreshMs: this.refreshMs
    };
  }
}
