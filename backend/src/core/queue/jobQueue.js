import { randomUUID } from 'node:crypto';
import { metrics } from '../../observability/metrics.js';
import { logger } from '../../utils/logger.js';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class JobQueue {
  constructor({
    name,
    redis,
    handlers = {},
    concurrency = 1,
    pollMs = 1000,
    maxAttempts = 3,
    visibilityMs = 60000
  }) {
    this.name = name;
    this.redis = redis;
    this.handlers = handlers;
    this.concurrency = concurrency;
    this.pollMs = pollMs;
    this.maxAttempts = maxAttempts;
    this.visibilityMs = visibilityMs;
    this.running = false;
    this.workers = [];
    this.localQueue = [];
    this.localDeadLetters = [];
  }

  queueKey() {
    return `queue:${this.name}:ready`;
  }

  deadLetterKey() {
    return `queue:${this.name}:dead`;
  }

  async enqueue(type, payload, options = {}) {
    const job = {
      id: options.id || randomUUID(),
      type,
      payload,
      attempts: 0,
      max_attempts: options.maxAttempts || this.maxAttempts,
      created_at: new Date().toISOString(),
      idempotency_key: options.idempotencyKey || null
    };

    if (this.redis?.isReady?.()) {
      await this.redis.lPush(this.queueKey(), JSON.stringify(job));
    } else {
      this.localQueue.unshift(job);
      logger.warn('Queued job in local memory because Redis is unavailable', { queue: this.name, job_id: job.id, type });
    }

    metrics.increment('queue_jobs_enqueued', { queue: this.name, type });
    return job;
  }

  async nextJob() {
    if (this.redis?.isReady?.()) {
      const raw = await this.redis.lPop(this.queueKey());
      return raw ? JSON.parse(raw) : null;
    }
    return this.localQueue.pop() ?? null;
  }

  async deadLetter(job, error) {
    const failed = {
      ...job,
      failed_at: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error)
    };

    if (this.redis?.isReady?.()) {
      await this.redis.lPush(this.deadLetterKey(), JSON.stringify(failed));
      await this.redis.lTrim(this.deadLetterKey(), 0, 999);
    } else {
      this.localDeadLetters.unshift(failed);
      this.localDeadLetters = this.localDeadLetters.slice(0, 1000);
    }

    metrics.increment('queue_jobs_dead_lettered', { queue: this.name, type: job.type });
  }

  async requeue(job) {
    if (this.redis?.isReady?.()) {
      await this.redis.lPush(this.queueKey(), JSON.stringify(job));
    } else {
      this.localQueue.unshift(job);
    }
  }

  async processJob(job) {
    const handler = this.handlers[job.type];
    if (!handler) {
      await this.deadLetter(job, new Error(`No handler registered for job type ${job.type}`));
      return;
    }

    const lockKey = job.idempotency_key ? `queue:${this.name}:lock:${job.idempotency_key}` : null;
    let lockValue = null;

    if (lockKey && this.redis?.isReady?.()) {
      lockValue = await this.redis.acquireLock(lockKey, this.visibilityMs);
      if (!lockValue) {
        metrics.increment('queue_jobs_skipped_locked', { queue: this.name, type: job.type });
        return;
      }
    }

    try {
      await metrics.time('queue_job_duration_ms', { queue: this.name, type: job.type }, () => handler(job.payload, job));
      metrics.increment('queue_jobs_completed', { queue: this.name, type: job.type });
    } catch (error) {
      job.attempts += 1;
      metrics.increment('queue_jobs_failed', { queue: this.name, type: job.type });
      logger.warn('Queue job failed', { queue: this.name, job_id: job.id, type: job.type, attempts: job.attempts, error });

      if (job.attempts >= job.max_attempts) {
        await this.deadLetter(job, error);
      } else {
        await sleep(Math.min(30000, 500 * 2 ** job.attempts));
        await this.requeue(job);
      }
    } finally {
      if (lockKey && lockValue && this.redis?.isReady?.()) {
        await this.redis.releaseLock(lockKey, lockValue).catch(() => null);
      }
    }
  }

  async workerLoop() {
    while (this.running) {
      const job = await this.nextJob().catch((error) => {
        logger.warn('Queue poll failed', { queue: this.name, error });
        return null;
      });

      if (!job) {
        await sleep(this.pollMs);
        continue;
      }

      await this.processJob(job);
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.workers = Array.from({ length: this.concurrency }, () => this.workerLoop());
    logger.info('Queue workers started', { queue: this.name, concurrency: this.concurrency });
  }

  async stop() {
    this.running = false;
    await Promise.allSettled(this.workers);
    this.workers = [];
    logger.info('Queue workers stopped', { queue: this.name });
  }

  stats() {
    return {
      queue: this.name,
      running: this.running,
      local_depth: this.localQueue.length,
      local_dead_letters: this.localDeadLetters.length
    };
  }
}
