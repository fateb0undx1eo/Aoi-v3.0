import pRetry from 'p-retry';
import { logger } from '../../utils/logger.js';
import { catboxProvider } from './catboxProvider.js';
import { stripFileMetadata } from './metadata.js';
import type { UploadConfig, UploadResult, UrlMap, AttachmentUri, AttachmentFallback, SkippedFile, FileDescriptor } from './types.js';
import { validateFile } from './validation.js';

function generateBatchId(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export class UploadService {
  private config: UploadConfig;

  constructor(config: UploadConfig) {
    if (config.timeoutMs <= 0) throw new Error('Upload config: timeoutMs must be > 0');
    if (config.maxConcurrentUploads < 1) throw new Error('Upload config: maxConcurrentUploads must be >= 1');
    if (config.maxRetries < 0) throw new Error('Upload config: maxRetries must be >= 0');
    this.config = config;
  }

  // ── Canonical single-file upload ─────────────────────────────────────────
  // Every upload path in the application goes through this method.
  // It owns validation, metadata stripping, retry, timeout, and Catbox upload.
  // Returns the public CDN URL. Throws on failure.
  async processFile(file: FileDescriptor): Promise<string> {
    const batchId = generateBatchId();
    const { originalname, mimetype, size, buffer } = file;

    logger.debug({ batchId, originalname, size }, 'upload: file received');

    const validationResult = validateFile(originalname, size, {
      maxFileSizeBytes: this.config.maxFileSizeBytes,
      bannedExtensions: this.config.bannedExtensions,
    });

    if (!validationResult.valid) {
      logger.debug({ batchId, outcome: 'skipped', reason: validationResult.reason }, 'upload: validation failed');
      throw new Error(validationResult.reason || 'File validation failed');
    }

    let processedBuffer = buffer;
    if (this.config.stripImageMetadata) {
      processedBuffer = await stripFileMetadata(buffer, mimetype);
    }

    const url = await pRetry(
      async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
        try {
          return await catboxProvider.upload(processedBuffer, validationResult.sanitizedName, {
            userHash: this.config.userHash,
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeout);
        }
      },
      {
        retries: this.config.maxRetries,
        onFailedAttempt: (error) => {
          logger.warn({ batchId, attempt: error.attemptNumber, error: error.message }, 'upload: attempt failed');
        },
      },
    );

    logger.info({ batchId, url }, 'upload: succeeded');
    return url;
  }

  // ── Batch coordinator (announcement flow) ────────────────────────────────
  // Iterates entry._rawFiles, delegates to processFile() for each,
  // and collects results into the UploadResult structure for announcement processing.
  // On Catbox failure the raw processed buffer is returned as a fallback
  // so AnnouncementService can attach it inline to the Discord payload.
  async processEntries(entries: any[]): Promise<UploadResult> {
    const batchId = generateBatchId();
    const startTime = performance.now();
    const urlMap: UrlMap = new Map();
    const fallbacks: AttachmentFallback[] = [];
    const skipped: SkippedFile[] = [];
    let uploaded = 0;

    const workItems: { entryId: string; fileIndex: number; file: any }[] = [];
    for (const entry of entries) {
      const rawFiles: any[] = (entry as any)._rawFiles || [];
      for (let i = 0; i < rawFiles.length; i++) {
        workItems.push({ entryId: entry.id, fileIndex: i, file: rawFiles[i] });
      }
    }

    const total = workItems.length;

    for (let i = 0; i < workItems.length; i += this.config.maxConcurrentUploads) {
      const batch = workItems.slice(i, i + this.config.maxConcurrentUploads);
      const batchResults = await Promise.allSettled(
        batch.map(async (item) => {
          const { entryId, fileIndex, file } = item;
          const { originalname, mimetype, size, buffer, spoiler, description } = file;

          const validationResult = validateFile(originalname, size, {
            maxFileSizeBytes: this.config.maxFileSizeBytes,
            bannedExtensions: this.config.bannedExtensions,
          });

          if (!validationResult.valid) {
            logger.debug({ batchId, entryId, fileIndex, outcome: 'skipped', reason: validationResult.reason }, 'upload: validation failed');
            return { outcome: 'skipped' as const, entryId, fileIndex, originalname, reason: validationResult.reason! };
          }

          let processedBuffer = buffer;
          if (this.config.stripImageMetadata) {
            processedBuffer = await stripFileMetadata(buffer, mimetype);
          }

          const uri = `attachment://${validationResult.sanitizedName}` as AttachmentUri;

          try {
            const fd: FileDescriptor = { originalname, mimetype, size, buffer: processedBuffer, spoiler, description };
            const url = await this.processFile(fd);
            return { outcome: 'uploaded' as const, uri, url, entryId, fileIndex };
          } catch (error: any) {
            logger.error({ batchId, entryId, fileIndex, originalname, error: error.message }, 'upload: all retries failed, falling back to inline attachment');
            return {
              outcome: 'fallback' as const,
              fallback: {
                entryId, fileIndex, originalname,
                buffer: processedBuffer, mimetype,
                size: processedBuffer.length, spoiler, description,
              },
            };
          }
        }),
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          const r = result.value;
          if (r.outcome === 'uploaded') {
            urlMap.set(r.uri, r.url);
            uploaded++;
          } else if (r.outcome === 'fallback') {
            fallbacks.push(r.fallback);
          } else {
            skipped.push({ entryId: r.entryId, fileIndex: r.fileIndex, originalname: r.originalname, reason: r.reason });
          }
        }
      }
    }

    return {
      urlMap,
      fallbacks,
      skipped,
      stats: {
        total,
        uploaded,
        fallback: fallbacks.length,
        skipped: skipped.length,
        durationMs: performance.now() - startTime,
      },
    };
  }
}
