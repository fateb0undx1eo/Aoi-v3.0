#!/usr/bin/env node
/**
 * Async Module Initialization Test
 * Verifies that tickets module can initialize with mock dependencies
 */

import { initializeTicketsModule } from './modules/tickets/index.js';
import { logger } from './utils/logger.js';

// Mock dependencies
const mockDependencies = {
  database: { isConnected: true },
  redis: { isReady: true },
  discordClient: { user: { id: 'mock_client_id' } },
  environment: {
    TICKET_LOG_LEVEL: 'INFO',
    NODE_ENV: 'development'
  }
};

async function testInitialization() {
  try {
    logger.info('Testing tickets module initialization...');
    
    const moduleDefinition = await initializeTicketsModule(mockDependencies);
    
    if (!moduleDefinition) {
      throw new Error('Module definition is null/undefined');
    }
    
    logger.info('✓ Module initialized successfully');
    logger.info(`  Commands: ${moduleDefinition.commands?.length || 0}`);
    logger.info(`  Events: ${moduleDefinition.events?.length || 0}`);
    logger.info(`  Services: ${Object.keys(moduleDefinition.services || {}).length}`);
    logger.info(`  Handlers: ${Object.keys(moduleDefinition.handlers || {}).length}`);
    logger.info(`  Jobs: ${moduleDefinition.jobs?.length || 0}`);
    
    // Verify structure
    if (moduleDefinition.commands?.length > 0) {
      logger.info(`✓ Found ${moduleDefinition.commands.length} command(s)`);
    }
    
    if (moduleDefinition.events?.length > 0) {
      logger.info(`✓ Found ${moduleDefinition.events.length} event(s)`);
    }
    
    if (moduleDefinition.services) {
      logger.info(`✓ Found ${Object.keys(moduleDefinition.services).length} service(s)`);
    }
    
    logger.info('\n✅ Initialization test PASSED!\n');
  } catch (error) {
    logger.error('❌ Initialization test FAILED:', error);
    process.exit(1);
  }
}

testInitialization();
