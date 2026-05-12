#!/usr/bin/env node
/**
 * Quick startup test - verifies module registration and initialization
 */

import { bootstrapRegistry } from './core/loader/bootstrap.js';
import { logger } from './utils/logger.js';

async function test() {
  try {
    logger.info('Testing module loading...');
    
    const registry = await bootstrapRegistry();
    logger.info(`✓ Registry loaded with ${registry.listDefinitions().length} modules`);
    
    // Check for async modules
    const asyncModuleCount = registry.asyncModules.size;
    logger.info(`✓ Found ${asyncModuleCount} async modules`);
    
    // Check for tickets module
    const asyncTickets = registry.asyncModules.get('tickets');
    if (asyncTickets) {
      logger.info('✓ Tickets module registered as async');
      logger.info(`  Init function name: ${asyncTickets.initFunction.name}`);
    } else {
      logger.warn('⚠️  Tickets module NOT found in async modules');
    }
    
    logger.info('✅ Module loading test passed!\n');
  } catch (error) {
    logger.error('❌ Test failed:', error);
    process.exit(1);
  }
}

test();
