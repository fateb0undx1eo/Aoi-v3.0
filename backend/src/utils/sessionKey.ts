import crypto from 'node:crypto';

const PBKDF2_ITERATIONS = 600_000;
const PBKDF2_KEY_LENGTH = 32;
const PBKDF2_DIGEST = 'sha512';
const SALT = 'aoi-v3-session-key';

const keyCache = new Map<string, Buffer>();

export function deriveSessionKey(secret: string): Buffer {
  const cached = keyCache.get(secret);
  if (cached) return cached;

  const key = crypto.pbkdf2Sync(
    secret,
    SALT,
    PBKDF2_ITERATIONS,
    PBKDF2_KEY_LENGTH,
    PBKDF2_DIGEST
  );

  keyCache.set(secret, key);
  return key;
}
