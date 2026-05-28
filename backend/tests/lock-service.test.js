import test from 'node:test';
import assert from 'node:assert/strict';
import LockService from '../src/modules/tickets/services/lock-service.js';

test('creation lock prevents concurrent duplicate acquisition with Redis NX', async () => {
  const store = new Map();
  const redis = {
    isReady: () => true,
    async set(key, value, mode, ttl, flag) {
      assert.equal(mode, 'PX');
      assert.equal(flag, 'NX');
      if (store.has(key)) return null;
      store.set(key, value);
      return 'OK';
    },
    async exists(key) {
      return store.has(key) ? 1 : 0;
    },
    async del(key) {
      store.delete(key);
    }
  };

  const locks = new LockService(redis);
  const userId = '123456789012345678';
  const results = await Promise.all([
    locks.acquireCreationLock(userId),
    locks.acquireCreationLock(userId),
    locks.acquireCreationLock(userId)
  ]);

  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(await locks.hasCreationLock(userId), true);
  await locks.releaseCreationLock(userId);
  assert.equal(await locks.hasCreationLock(userId), false);
});

test('creation lock uses local degraded mode when Redis is unavailable', async () => {
  const locks = new LockService({
    isReady: () => false,
    async del() {}
  });
  const userId = '123456789012345678';

  assert.equal(await locks.acquireCreationLock(userId), true);
  assert.equal(await locks.acquireCreationLock(userId), false);
  assert.equal(await locks.hasCreationLock(userId), true);
  await locks.releaseCreationLock(userId);
  assert.equal(await locks.hasCreationLock(userId), false);
});
