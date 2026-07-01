export type AttachmentUri = `attachment://${string}`;
export type UrlMap = Map<AttachmentUri, string>;

export interface FileDescriptor {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
  spoiler?: boolean;
  description?: string;
}

export interface AttachmentFallback {
  entryId: string;
  fileIndex: number;
  originalname: string;
  buffer: Buffer;
  mimetype: string;
  size: number;
  spoiler: boolean;
  description?: string;
}

export interface SkippedFile {
  entryId: string;
  fileIndex: number;
  originalname: string;
  reason: string;
}

export interface UploadStats {
  total: number;
  uploaded: number;
  fallback: number;
  skipped: number;
  durationMs: number;
}

export interface UploadResult {
  urlMap: UrlMap;
  fallbacks: AttachmentFallback[];
  skipped: SkippedFile[];
  stats: UploadStats;
}

export interface UploadConfig {
  timeoutMs: number;
  maxConcurrentUploads: number;
  maxRetries: number;
  retryBaseDelayMs: number;
  userHash?: string;
  maxFileSizeBytes: number;
  bannedExtensions: string[];
  stripImageMetadata: boolean;
}
