#!/usr/bin/env node
/**
 * Test script to check what modules the API would return
 */

import { bootstrapRegistry } from './src/core/loader/bootstrap.js';
import { ModuleService } from './src/services/moduleService.js';
import { ConfigCache } from './src/core/configCache/configCache.js';
import { ConfigService } from './src/services/configService.js';
import { logger } from './src/utils/logger.js';

async function test() {
  try {
    logger.info('Testing what modules would be returned to the API...\n');
    
    const registry = await bootstrapRegistry();
    const configService = new ConfigService();
    const configCache = new ConfigCache(configService);
    const moduleService = new ModuleService(registry, configCache);
    
    // Test with your guild ID
    const guildId = '1457403601080287294';
    const modules = moduleService.listModules(guildId);
    
    logger.info(`Modules returned for guild ${guildId}:`);
    modules.forEach(m => {
      logger.info(`  - ${m.name} (enabled: ${m.enabled !== false})`);
    });
    
    const communityModule = modules.find(m => m.name === 'community');
    if (!communityModule) {
      logger.warn('\n✗ Community module NOT in API response!');
    } else {
      logger.info('\n✓ Community module IS in API response');
      logger.info(`  enabled: ${communityModule.enabled}`);
      logger.info(`  configSchema: ${!!communityModule.configSchema}`);
    }
    
    logger.info('\n✅ Test completed\n');
  } catch (error) {
    logger.error('❌ Test failed:', error);
    process.exit(1);
  }
}

test();
