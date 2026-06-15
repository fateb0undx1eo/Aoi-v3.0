import { Queue, Worker, QueueEvents } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { metrics } from '../../observability/metrics.js';
import { logger } from '../../utils/logger.js';
import { redisClient } from '../redis.js';

interface JobPayload {
  id: string;
  type: string;
  payload: any;
  attempts: number;
  max_attempts: number;
  created_at: string;
  idempotency_key: string | null;
}

interface JobOptions {
  id?: string;
  maxAttempts?: number;
  idempotencyKey?: string;
  delay?: number;
}

interface JobHandler {
  (payload: any, job?: JobPayload): Promise<void>;
}

interface JobQueueStats {
  queue: string;
  running: boolean;
  local_depth: number;
  local_dead_letters: number;
  bullmq_waiting?: number;
  bullmq_active?: number;
  bullmq_failed?: number;
}

type HandlersMap = Record<string, JobHandler>;

export class JobQueue {
  private name: string;
  private handlers: HandlersMap;
  private concurrency: number;
  private running: boolean;
  private workers: Promise<void>[];
  private localQueue: JobPayload[];
  private localDeadLetters: JobPayload[];
  private bullQueue: Queue | null;
  private bullWorker: Worker | null;
  private bullEvents: QueueEvents | null;
  private useBullMQ: boolean;

  constructor({
    name,
    redis,
    handlers = {},
    concurrency = 1,
    pollMs = 1000,
    maxAttempts = 3,
    visibilityMs = 60000
  }: {
    name: string;
    redis: any;
    handlers?: HandlersMap;
    concurrency?: number;
    pollMs?: number;
    maxAttempts?: number;
    visibilityMs?: number;
  }) {
    this.name = name;
    this.handlers = handlers;
    this.concurrency = concurrency;
    this.running = false;
    this.workers = [];
    this.localQueue = [];
    this.localDeadLetters = [];
    this.bullQueue = null;
    this.bullWorker = null;
    this.bullEvents = null;

    // Use BullMQ when Redis is available
    this.useBullMQ = redis?.isReady?.() && redisClient.isReady();

    if (this.useBullMQ) {
      this.setupBullMQ();
    }
  }

  private setupBullMQ(): void {
    try {
      const connection = redisClient.getClient();

      if (!connection) {
        logger.warn(`Redis client not ready, falling back to local queue for ${this.name}`);
        this.useBullMQ = false;
        return;
      }

      this.bullQueue = new Queue(this.name, {
        connection: connection as any,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000
          },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 50 }
        }
      });

      this.bullEvents = new QueueEvents(this.name, { connection: connection as any });

      this.bullEvents.on('completed', ({ jobId }) => {
        metrics.increment('queue_jobs_completed', { queue: this.name });
        logger.debug(`BullMQ job completed: ${jobId}`);
      });

      this.bullEvents.on('failed', ({ jobId, failedReason }) => {
        metrics.increment('queue_jobs_failed', { queue: this.name });
        logger.warn(`BullMQ job failed: ${jobId} - ${failedReason}`);
      });

      logger.info(`BullMQ queue initialized: ${this.name}`);
    } catch (error) {
      logger.warn(`Failed to initialize BullMQ for ${this.name}, falling back to local queue`, error);
      this.useBullMQ = false;
      this.bullQueue = null;
      this.bullEvents = null;
    }
  }

  async enqueue(type: string, payload: any, options: JobOptions = {}): Promise<JobPayload> {
    const job: JobPayload = {
      id: options.id || randomUUID(),
      type,
      payload,
      attempts: 0,
      max_attempts: options.maxAttempts || 3,
      created_at: new Date().toISOString(),
      idempotency_key: options.idempotencyKey || null
    };

    if (this.useBullMQ && this.bullQueue) {
      await this.bullQueue.add(type, job, {
        jobId: job.id,
        attempts: job.max_attempts,
        delay: options.delay,
        backoff: { type: 'exponential', delay: 2000 }
      });
    } else {
      this.localQueue.push(job);
    }

    metrics.increment('queue_jobs_enqueued', { queue: this.name, type });
    return job;
  }

  start(): void {
    if (this.running) return;
    this.running = true;

    if (this.useBullMQ) {
      const connection = redisClient.getClient();
      if (!connection) {
        logger.warn(`Redis not available, cannot start BullMQ worker for ${this.name}`);
        this.useBullMQ = false;
        this.start();
        return;
      }

      this.bullWorker = new Worker(
        this.name,
        async (bullJob) => {
          const jobData = bullJob.data as JobPayload;
          const handler = this.handlers[jobData.type];
          if (!handler) {
            throw new Error(`No handler registered for job type ${jobData.type}`);
          }
          await handler(jobData.payload, jobData);
        },
        {
          connection: connection as any,
          concurrency: this.concurrency,
          lockDuration: 60000,
          stalledInterval: 30000
        }
      );

      this.bullWorker.on('error', (error) => {
        logger.warn(`BullMQ worker error (${this.name}):`, error);
      });

      logger.info(`BullMQ worker started: ${this.name} (concurrency: ${this.concurrency})`);
    } else {
      this.workers = Array.from({ length: this.concurrency }, () => this.workerLoop());
      logger.info('Local queue workers started', { queue: this.name, concurrency: this.concurrency });
    }
  }

  async stop(): Promise<void> {
    this.running = false;

    if (this.bullWorker) {
      await this.bullWorker.close();
      this.bullWorker = null;
    }
    if (this.bullQueue) {
      await this.bullQueue.close();
      this.bullQueue = null;
    }
    if (this.bullEvents) {
      await this.bullEvents.close();
      this.bullEvents = null;
    }

    await Promise.allSettled(this.workers);
    this.workers = [];
    logger.info('Queue workers stopped', { queue: this.name });
  }

  async stats(): Promise<JobQueueStats> {
    const stats: JobQueueStats = {
      queue: this.name,
      running: this.running,
      local_depth: this.localQueue.length,
      local_dead_letters: this.localDeadLetters.length
    };

    if (this.useBullMQ && this.bullQueue) {
      const jobCounts = await this.bullQueue.getJobCounts();
      stats.bullmq_waiting = jobCounts.waiting;
      stats.bullmq_active = jobCounts.active;
      stats.bullmq_failed = jobCounts.failed;
    }

    return stats;
  }

  // ─── Fallback local queue processing ──────────────────────────
  private async nextJob(): Promise<JobPayload | null> {
    return this.localQueue.pop() ?? null;
  }

  private async processJob(job: JobPayload): Promise<void> {
    const handler = this.handlers[job.type];
    if (!handler) {
      this.localDeadLetters.push(job);
      return;
    }

    try {
      await handler(job.payload, job);
    } catch (error: any) {
      job.attempts += 1;
      if (job.attempts >= job.max_attempts) {
        this.localDeadLetters.push(job);
      } else {
        this.localQueue.push(job);
      }
    }
  }

  private async workerLoop(): Promise<void> {
    while (this.running) {
      const job = await this.nextJob();
      if (!job) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }
      await this.processJob(job);
    }
  }
}
