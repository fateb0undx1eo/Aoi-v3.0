import test from 'node:test';
import assert from 'node:assert/strict';
import { ConfigCache } from '../src/core/configCache/configCache.js';

test('config cache warms module, command, and welcome data', async () => {
  const service = {
    async getGuildModuleConfigs(guildId) {
      return [{ guild_id: guildId, module_name: 'tickets', enabled: true }];
    },
    async getGuildCommandConfigs(guildId) {
      return [{ guild_id: guildId, command_name: 'ticket', enabled: true }];
    },
    async getWelcomeConfig(guildId) {
      return {
        guild_id: guildId,
        is_enabled: true,
        config_json: { enabled: true, channel_id: '123456789012345678', message: 'Hi {user}' }
      };
    }
  };

  const cache = new ConfigCache(service, 1000);
  await cache.warmGuild('111111111111111111');

  assert.equal(cache.getModuleConfig('111111111111111111', 'tickets').enabled, true);
  assert.equal(cache.getCommandConfig('111111111111111111', 'ticket').enabled, true);
  assert.equal(cache.getWelcomeConfig('111111111111111111').channel_id, '123456789012345678');
});

test('config cache auto refresh lifecycle can start and stop cleanly', async () => {
  const service = {
    async getGuildModuleConfigs() { return []; },
    async getGuildCommandConfigs() { return []; },
    async getWelcomeConfig() { return null; }
  };
  const cache = new ConfigCache(service, 50);

  cache.startAutoRefresh(async () => ['111111111111111111']);
  assert.ok(cache.timer);
  cache.stopAutoRefresh();
  assert.equal(cache.timer, null);
});
