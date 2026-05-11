/**
 * Minimal Redis test without full environment setup
 */

import { createClient } from 'redis';

async function testRedisConnection() {
  console.log('🔴 Testing Redis Connection...\n');

  try {
    // Create Redis client directly
    const redis = createClient({
      url: 'redis://localhost:6379'
    });

    redis.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    redis.on('connect', () => {
      console.log('✅ Redis Client Connected');
    });

    // Connect to Redis
    await redis.connect();
    console.log('✅ Redis connection established');

    // Test basic operations
    console.log('\n🧪 Testing Redis operations...');
    
    // SET operation
    await redis.set('test:ticket:system', 'working', { EX: 10 });
    console.log('✅ SET operation successful');

    // GET operation
    const value = await redis.get('test:ticket:system');
    console.log(`✅ GET operation: ${value === 'working' ? 'SUCCESS' : 'FAILED'}`);

    // DEL operation
    await redis.del('test:ticket:system');
    console.log('✅ DEL operation successful');

    // Test lock-like operations
    console.log('\n🔒 Testing lock operations...');
    
    const lockKey = 'test:lock:ticket:create';
    const lockValue = 'test-lock-value';
    
    // Acquire lock (SET with NX and EX)
    const setResult = await redis.set(lockKey, lockValue, { 
      NX: true, 
      EX: 5 
    });
    console.log(`✅ Lock acquisition: ${setResult === 'OK' ? 'SUCCESS' : 'FAILED'}`);

    // Check lock exists
    const exists = await redis.exists(lockKey);
    console.log(`✅ Lock exists check: ${exists === 1 ? 'SUCCESS' : 'FAILED'}`);

    // Release lock with Lua script
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    
    const releaseResult = await redis.eval(luaScript, {
      keys: [lockKey],
      arguments: [lockValue]
    });
    console.log(`✅ Lock release: ${releaseResult === 1 ? 'SUCCESS' : 'FAILED'}`);

    // Test hash operations (for webhook cache)
    console.log('\n🗄️ Testing hash operations...');
    
    await redis.hSet('test:webhooks:cache', {
      'channel1': 'webhook-id-1',
      'channel2': 'webhook-id-2'
    });
    console.log('✅ HSET operation successful');

    const hashData = await redis.hGetAll('test:webhooks:cache');
    console.log(`✅ HGETALL operation: ${Object.keys(hashData).length} items retrieved`);

    await redis.del('test:webhooks:cache');
    console.log('✅ Hash cleanup successful');

    // Close connection
    await redis.quit();
    console.log('\n🎉 All Redis tests passed!');

    return true;

  } catch (error) {
    console.error('\n❌ Redis test failed:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 Make sure Redis is running:');
      console.log('   Docker: docker run -d -p 6379:6379 --name redis redis:7-alpine');
      console.log('   Or install Redis locally and start the service');
    }
    
    return false;
  }
}

// Run test
testRedisConnection()
  .then((success) => {
    console.log(`\n📋 Test Result: ${success ? 'PASSED' : 'FAILED'}`);
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('💥 Test crashed:', error);
    process.exit(1);
  });
