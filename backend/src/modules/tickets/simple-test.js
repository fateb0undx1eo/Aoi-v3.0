/**
 * Simple test for core functionality without full environment setup
 */

// Mock environment for testing
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.TICKET_LOG_LEVEL = 'INFO';

async function testCoreServices() {
  console.log('🧪 Testing Core Services...\n');

  try {
    // Test Redis connection
    console.log('🔴 Testing Redis connection...');
    const { redisClient } = await import('../../core/redis.js');
    const isReady = redisClient.isReady();
    console.log(`Redis status: ${isReady ? '✅ Connected' : '❌ Not connected'}`);

    if (isReady) {
      // Test basic Redis operations
      await redisClient.setWithTTL('test:ticket', 'working', 1000);
      const value = await redisClient.get('test:ticket');
      console.log(`Redis test: ${value === 'working' ? '✅ Working' : '❌ Failed'}`);
      
      await redisClient.delete('test:ticket');
    }

    // Test lock service
    console.log('\n🔒 Testing lock service...');
    const { lockService } = await import('./services/lock-service.js');
    
    const lockValue = await lockService.acquireCreationLock('test-guild', 'test-user', 1000);
    console.log(`Lock acquisition: ${lockValue ? '✅ Success' : '❌ Failed'}`);
    
    if (lockValue) {
      const released = await lockService.releaseCreationLock('test-guild', 'test-user', lockValue);
      console.log(`Lock release: ${released ? '✅ Success' : '❌ Failed'}`);
    }

    // Test logger
    console.log('\n📝 Testing logger...');
    const { logger } = await import('./utils/logger.js');
    logger.info('Test log message', { test: true });
    console.log('✅ Logger working');

    console.log('\n🎉 Core services test completed!');
    return true;

  } catch (error) {
    console.error('\n❌ Core services test failed:', error.message);
    return false;
  }
}

// Run test
testCoreServices()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('💥 Test crashed:', error);
    process.exit(1);
  });
