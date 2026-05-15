#!/usr/bin/env node
/**
 * Direct module loading test
 */

import { bootstrapRegistry } from './src/core/loader/bootstrap.js';
import { logger } from './src/utils/logger.js';

async function test() {
  try {
    logger.info('Testing module loading...');
    const registry = await bootstrapRegistry();
    
    const modules = registry.listDefinitions();
    logger.info(`✓ Found ${modules.length} modules:`);
    modules.forEach(m => logger.info(`  - ${m.name}`));
    
    // Check specifically for community
    const community = modules.find(m => m.name === 'community');
    if (community) {
      logger.info('✓ COMMUNITY MODULE FOUND');
      logger.info(`  Commands: ${community.commands.length}`);
      logger.info(`  Events: ${community.events.length}`);
      logger.info(`  Has configSchema: ${!!community.configSchema}`);
    } else {
      logger.warn('✗ COMMUNITY MODULE NOT FOUND');
    }
    
    logger.info('✅ Test completed\n');
  } catch (error) {
    logger.error('❌ Test failed:', error);
    process.exit(1);
  }
}

test();
