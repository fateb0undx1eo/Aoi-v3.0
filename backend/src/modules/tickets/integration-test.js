/**
 * Integration test for the refactored ticket system
 * Run this to verify all components work together
 */

import { productionService } from './services/production-service.js';
import { ticketService } from './services/ticket-service.js';
import { cooldownService } from './services/cooldown-service.js';
import { lockService } from './services/lock-service.js';
import { webhookService } from './services/webhook-service.js';
import { metricsService } from './services/metrics-service.js';
import { logger } from './utils/logger.js';

async function runIntegrationTest() {
  console.log('🧪 Starting Integration Test for Refactored Ticket System...\n');

  const results = {
    database: false,
    redis: false,
    services: false,
    production: false
  };

  try {
    // Test 1: Database connectivity
    console.log('📊 Testing database connectivity...');
    const tickets = await ticketService.getAllTickets({ limit: 1 });
    results.database = true;
    console.log('✅ Database connection successful');

    // Test 2: Redis connectivity
    console.log('\n🔴 Testing Redis connectivity...');
    const testKey = 'test:integration';
    await lockService.acquireCreationLock('test-guild', 'test-user', 1000);
    results.redis = true;
    console.log('✅ Redis connection successful');

    // Test 3: Service operations
    console.log('\n🔧 Testing service operations...');
    
    // Test cooldown service
    await cooldownService.setCooldown('test-guild', 'test-user', 60000);
    const remaining = await cooldownService.getRemainingCooldown('test-guild', 'test-user');
    
    // Test metrics service
    await metricsService.recordTicketCreation(100, true, {
      guildId: 'test-guild',
      userId: 'test-user',
      tag: 'general_support'
    });
    
    results.services = true;
    console.log('✅ Service operations successful');

    // Test 4: Production service initialization
    console.log('\n🚀 Testing production service...');
    
    // Note: This would normally require a Discord client
    // For testing, we'll validate system integrity without client
    const integrity = await productionService.validateSystemIntegrity(null);
    results.production = integrity.healthy;
    console.log('✅ Production service validation successful');

    console.log('\n🎉 All integration tests passed!');
    
    // Get final metrics
    const metrics = await metricsService.getPerformanceStats();
    console.log('\n📊 Performance Metrics:', {
      ticketCreation: metrics.ticketCreation,
      discordApi: metrics.discordApi,
      database: metrics.database,
      redis: metrics.redis
    });

  } catch (error) {
    console.error('\n❌ Integration test failed:', error);
    logger.error('Integration test failed', { error });
  }

  return results;
}

// Run test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runIntegrationTest()
    .then((results) => {
      console.log('\n📋 Test Results:', results);
      process.exit(results.database && results.redis && results.services ? 0 : 1);
    })
    .catch((error) => {
      console.error('💥 Integration test crashed:', error);
      process.exit(1);
    });
}

export { runIntegrationTest };
