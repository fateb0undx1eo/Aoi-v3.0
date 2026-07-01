import { catboxProvider } from './catboxProvider.js';
import type { UploadConfig } from './types.js';

export function loadUploadConfig(): UploadConfig {
  return {
    timeoutMs: Number(process.env.CATBOX_TIMEOUT_MS ?? 30_000),
    maxConcurrentUploads: Number(process.env.CATBOX_MAX_CONCURRENT_UPLOADS ?? 3),
    maxRetries: Number(process.env.CATBOX_MAX_RETRIES ?? 3),
    retryBaseDelayMs: 1_000,
    userHash: process.env.CATBOX_USER_HASH || undefined,
    maxFileSizeBytes: catboxProvider.maxFileSizeBytes,
    bannedExtensions: [
      '.exe', '.scr', '.com', '.pif', '.bat', '.cmd',
      '.vbs', '.vbe', '.js', '.jse', '.wsf', '.wsh',
      '.ps1', '.psm1', '.msi', '.msp', '.reg', '.scr',
    ],
    stripImageMetadata: true,
  };
}
