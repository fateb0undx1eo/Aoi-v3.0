# ADR-002: Catbox Upload Pipeline Migration

**Status:** Approved
**Date:** 2026-06-30
**Context:** Replace broken ImgBB upload pipeline with Catbox while extracting upload into a dedicated, maintainable module.

---

## Architecture Summary

```
UploadService returns a URL mapping instead of mutating entries directly.

Result: { urlMap, fallbacks, skipped, stats }

announcementService then:
  1. replaceAttachmentUris(entries, result.urlMap)
  2. create AttachmentBuilder[] from result.fallbacks
  3. send/edit via Discord (unchanged)
```

This keeps UploadService completely unaware of Discord entry structures.

---

## File Manifest

**7 new files** under `backend/src/services/upload/`:

```
backend/src/services/upload/
├── config.ts           # loadUploadConfig() — only file touching process.env for upload
├── types.ts            # UploadConfig, UploadResult, AttachmentFallback, UrlMap, etc.
├── validation.ts       # validateFile(file, options), sanitizeFilename()
├── metadata.ts         # stripFileMetadata(buffer, mimetype)
├── catboxProvider.ts   # export const catboxProvider = { name, maxFileSizeBytes, supportsMimeType(), upload() }
├── urlReplacer.ts      # replaceAttachmentUris(entries, urlMap) — centralizes all attachment:// replacement
└── uploadService.ts    # class UploadService — validates → strips → retries → uploads → returns UploadResult
```

---

## Types (types.ts)

```typescript
type AttachmentUri = `attachment://${string}`
type UrlMap = Map<AttachmentUri, string>

interface AttachmentFallback {
  entryId: string
  fileIndex: number
  originalname: string
  buffer: Buffer
  mimetype: string
  size: number
  spoiler: boolean
  description?: string
}

interface SkippedFile {
  entryId: string
  fileIndex: number
  originalname: string
  reason: string
}

interface UploadStats {
  total: number
  uploaded: number
  fallback: number
  skipped: number
  durationMs: number
}

interface UploadResult {
  urlMap: UrlMap
  fallbacks: AttachmentFallback[]
  skipped: SkippedFile[]
  stats: UploadStats
}

interface UploadConfig {
  timeoutMs: number
  maxConcurrentUploads: number
  maxRetries: number
  retryBaseDelayMs: number
  userHash?: string
  maxFileSizeBytes: number
  bannedExtensions: string[]
  stripImageMetadata: boolean
}
```

---

## Config (config.ts)

Single module that reads all `process.env.CATBOX_*` variables. Called once in `main.ts`.

```typescript
function loadUploadConfig(): UploadConfig {
  return {
    timeoutMs: Number(process.env.CATBOX_TIMEOUT_MS ?? 30_000),
    maxConcurrentUploads: Number(process.env.CATBOX_MAX_CONCURRENT_UPLOADS ?? 3),
    maxRetries: Number(process.env.CATBOX_MAX_RETRIES ?? 3),
    retryBaseDelayMs: 1_000,
    userHash: process.env.CATBOX_USER_HASH || undefined,
    maxFileSizeBytes: catboxProvider.maxFileSizeBytes,  // reads from provider
    bannedExtensions: [
      '.exe', '.scr', '.com', '.pif', '.bat', '.cmd',
      '.vbs', '.vbe', '.js', '.jse', '.wsf', '.wsh',
      '.ps1', '.psm1', '.msi', '.msp', '.reg', '.scr',
    ],
    stripImageMetadata: true,
  }
}
```

No `process.env` touched anywhere else for upload config.

---

## Metadata (metadata.ts)

Isolated — knows nothing about Catbox, retries, filenames, or validation.

```typescript
async function stripFileMetadata(buffer: Buffer, mimetype: string): Promise<Buffer> {
  if (!mimetype.startsWith('image/')) return buffer
  try {
    const sharp = await import('sharp')
    return await sharp(buffer).rotate().toBuffer()
  } catch {
    return buffer
  }
}
```

No GIF special-case. If Sharp throws, return original.

UploadService checks `config.stripImageMetadata` before calling.

---

## Validation (validation.ts)

Completely provider-agnostic. Receives limits from config.

```typescript
interface ValidationOptions {
  maxFileSizeBytes: number
  bannedExtensions: string[]
}

interface ValidationResult {
  valid: boolean
  sanitizedName: string
  reason?: string
}

function validateFile(
  originalname: string,
  mimetype: string,
  size: number,
  options: ValidationOptions,
): ValidationResult

function sanitizeFilename(name: string): string
```

`sanitizeFilename()` is the canonical implementation. Frontend has a documented mirror.

---

## Catbox Provider (catboxProvider.ts)

Exported object — no class, no interface, no factory.

```typescript
export const catboxProvider = {
  name: 'catbox',
  maxFileSizeBytes: 200 * 1024 * 1024,

  supportsMimeType(_mimetype: string): boolean {
    return true
  },

  async upload(
    buffer: Buffer,
    filename: string,
    options?: { userHash?: string; signal?: AbortSignal },
  ): Promise<string> {
    // FormData: reqtype=fileupload, fileToUpload, optional userhash
    // POST https://catbox.moe/user/api.php
    // Response starts with https://files.catbox.moe/ → return it
    // Otherwise → throw
  },
}
```

Only responsibility: build FormData, POST, parse response, throw on error.

No retries, no timeout, no validation, no concurrency.

---

## Upload Service (uploadService.ts)

Orchestrator. Never mutates entries — returns UploadResult.

```
processEntries(entries):
  generate batchId (nanoid)
  for each entry → for each file:
    1. validateFile(file, config)
       └─ invalid → skipped, log reason
    2. if config.stripImageMetadata:
         stripFileMetadata(buffer, mimetype)
    3. p-retry(uploadToCatbox, { retries, backoff })
       └─ AbortController with config.timeoutMs
       └─ catches → retry → fallback
    4. success → add to urlMap
    5. failure → add to fallbacks
  build stats
  return UploadResult
```

Batch concurrency (manual, no p-limit):
```typescript
for (let i = 0; i < workItems.length; i += config.maxConcurrentUploads) {
  const batch = workItems.slice(i, i + config.maxConcurrentUploads)
  const batchResults = await Promise.allSettled(batch.map(f => this.uploadFile(f)))
}
```

---

## URL Replacer (urlReplacer.ts)

Pure function. Centralizes all `attachment://` URL replacement for `NormalizedEntry` payloads.

```typescript
function replaceAttachmentUris(entries: NormalizedEntry[], urlMap: UrlMap): void
```

Walks both V2 components (`_rawComponents`) and legacy embed fields (`embeds[]`). No upload knowledge.

---

## Logging Strategy

Every log line includes: `batchId`, `entryId`, `fileIndex`, `originalname`.

```typescript
logger.debug({ batchId, entryId, fileIndex, originalname, size }, 'upload: file received')
logger.debug({ batchId, entryId, fileIndex, outcome, reason }, 'upload: validated')
logger.warn({ batchId, entryId, fileIndex, attempt, error }, 'upload: attempt failed')
logger.info({ batchId, entryId, fileIndex, attempt, durationMs }, 'upload: attempt succeeded')
logger.info({ batchId, stats }, 'upload: batch complete')           // stats includes durationMs
```

After pipeline is verified, reduce to `warn`/`error` only.

---

## Flow (final)

```
Request → Multer (200MB per file)
  → too many files? (>10) — 400 before parsing body
  → Route handler assembles _entryFiles (unchanged)
  → announcementService.send():
       normalizePayload()                          // unchanged
       uploadService.processEntries(entries)        // NEW — returns UploadResult
       replaceAttachmentUris(entries, result.urlMap) // NEW — pure transformation
       create AttachmentBuilder[] from fallbacks     // NEW
       split entries into new/edit                  // unchanged
       resolve guild + channels                     // unchanged
       editExistingEntry() / sendEntry()            // unchanged
```

---

## Multer Changes (guildRoutes.ts)

```typescript
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
})
```

Route handler — before parsing payload JSON:
```typescript
if (Array.isArray(req.files) && req.files.length > 10) {
  res.status(400).json({ error: 'Maximum 10 files per announcement' })
  return
}
```

---

## Frontend Changes (FileAttachmentEditor.tsx)

| Current | New |
|---|---|
| `IMG_HOST_MIMETYPES` (12 image types) | Delete |
| `IMG_HOST_MAX_SIZE` (32 MB) | Replace with `UPLOAD_MAX_SIZE = 200 * 1024 * 1024` |
| `isImgbbImage(f)` — MIME + size check | `isUploadEligible(f)` — size-only check |
| Badge: "imgbb" (green) | Badge: "Catbox" (green) |
| Warning: "exceeds imgbb 32MB" | Warning: "exceeds 200MB upload limit" |

`sanitizeFilename()` in `validation.ts` is canonical. Frontend's `transformFileName()` in `utils/files.ts` mirrors it with a comment:
```typescript
// Mirrors backend sanitizeFilename() in services/upload/validation.ts.
// Both MUST match — attachment:// URIs are built from this output.
```

---

## Environment Variables

| Variable | Status | Default |
|---|---|---|
| `IMG_HOST` | **REMOVE** | — |
| `CATBOX_USER_HASH` | **Required** (non-anonymous uploads) | `9ac8a14e2cd4732fd019cde55` |
| `CATBOX_TIMEOUT_MS` | Add (optional) | 30000 |
| `CATBOX_MAX_CONCURRENT_UPLOADS` | Add (optional) | 3 |
| `CATBOX_MAX_RETRIES` | Add (optional) | 3 |

All Catbox vars are optional except `CATBOX_USER_HASH` for non-anonymous uploads.

---

## Catbox API Reference

**Endpoint:** `https://catbox.moe/user/api.php`
**Method:** POST
**Content-Type:** `multipart/form-data`

### File Upload (the only one we use)

```
reqtype="fileupload"
userhash="####"
fileToUpload=<file blob>
```

Response on success: `https://files.catbox.moe/<randomid>.<ext>` (plain text)
Response on error: error message string (not a URL)

### Other available operations (NOT implemented, documented for future reference)

**URL Upload:**
```
reqtype="urlupload" userhash="####" url="http://..."
```

**Delete Files:**
```
reqtype="deletefiles" userhash="####" files="eh871k.png d9pove.gif"
```

**Album Management:**
- `reqtype="createalbum" userhash="####" title="..." desc="..." files="..."` — space-separated file IDs
- `reqtype="editalbum" userhash="####" short="pd412w" title="..." desc="..." files="..."` — must supply ALL args
- `reqtype="addtoalbum" userhash="####" short="pd412w" files="..."`
- `reqtype="removefromalbum" userhash="####" short="pd412w" files="..."`
- `reqtype="deletealbum" userhash="####" short="pd412w"`

Albums limited to 500 files.

### Notes

- For anonymous uploads: omit `userhash` entirely. We are NOT doing anonymous uploads.
- Delete and album operations are NOT needed for the current pipeline.
- The `userhash` for this project is `9ac8a14e2cd4732fd019cde55`.

---

## Startup Self-Test (main.ts)

```typescript
// Do NOT make network requests — just verify dependencies load
try {
  await import('sharp')
} catch {
  logger.warn('sharp not available — image metadata stripping disabled')
}

const uploadConfig = loadUploadConfig()
// UploadService constructor validates: timeoutMs > 0, maxRetries >= 0, etc.
```

---

## Graceful Degradation (non-negotiable)

1. Catbox upload fails → fall back to `AttachmentBuilder` (Discord-native attachment)
2. All files fail Catbox → announcement sends with zero CDN URLs, all files as Discord attachments
3. Catbox is entirely unavailable → same as (2)
4. **Never fail an announcement because Catbox failed**

---

## Implementation Order

```
 1. config.ts
 2. types.ts
 3. validation.ts
 4. metadata.ts
 5. catboxProvider.ts
 6. uploadService.ts
 7. urlReplacer.ts
 8. Unit test UploadService in isolation (mock catboxProvider)
 9. Mod: announcementService.ts  — refactor send(), wire UploadService + urlReplacer
10. Mod: guildRoutes.ts          — 200MB, >10 file check before body parse
11. Mod: main.ts                 — loadUploadConfig(), instantiate, inject, self-test
12. Mod: FileAttachmentEditor.tsx — badge text + constants
13. Mod: .env.example
14. Verify image uploads, video uploads, attachment:// replacement, metadata stripping, fallback
15. Delete all ImgBB code:
    - uploadToImgbb() in announcementService.ts
    - IMG_HOST_MIMETYPES (both files)
    - replaceAttachmentUrlsInComponents() (moved to urlReplacer.ts)
    - MD5 dedup code
    - createHash import
    - IMG_HOST env var usage
16. Cleanup: unused imports, lint, typecheck, test
```

---

## What Stays Unchanged

- All frontend pages and components except FileAttachmentEditor badge text
- All frontend types (DraftFile, APIAttachment, etc.)
- utils/discord.ts (webhook path is completely independent)
- utils/files.ts (except adding mirror comment to transformFileName)
- Next.js proxy route
- lib/backend.ts
- All middleware (requireAuth, requireGuildAccess, rateLimiter)
- API server setup (server.ts)
- announcementService normalization helpers
- announcementService Discord payload builders (buildEntryPayload, etc.)
- announcementService sendEntry() / editExistingEntry()
- All other services

---

## Dependency Changes

```bash
bun add sharp   # backend/
```

`sharp` used only for EXIF/metadata stripping in `metadata.ts`.

---

## Key Rules

1. `UploadService.processEntries()` returns `UploadResult` — does NOT mutate entries
2. `replaceAttachmentUris()` is a separate pure function — called by announcementService after upload
3. Provider is a simple exported object, not a class/interface/factory
4. No `process.env` touched outside `config.ts` for upload config
5. Metadata stripping is config-driven (`stripImageMetadata: boolean`), not provider-enforced
6. `sanitizeFilename()` has ONE canonical version in the backend; frontend mirrors it
7. Never throw for Catbox failures — always return UploadResult with structured outcomes
8. Validate file count (>10) before parsing the request body
