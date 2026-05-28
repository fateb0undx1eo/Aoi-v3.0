import test from 'node:test';
import assert from 'node:assert/strict';
import { JobQueue } from '../src/core/queue/jobQueue.js';

test('job queue processes local degraded-mode jobs and records dead letters', async () => {
  let processed = 0;
  const queue = new JobQueue({
    name: 'test',
    redis: { isReady: () => false },
    handlers: {
      ok: async () => { processed += 1; },
      fail: async () => { throw new Error('boom'); }
    },
    maxAttempts: 1
  });

  await queue.enqueue('ok', {});
  await queue.enqueue('fail', {});
  await queue.processJob(await queue.nextJob());
  await queue.processJob(await queue.nextJob());

  assert.equal(processed, 1);
  assert.equal(queue.stats().local_dead_letters, 1);
});
