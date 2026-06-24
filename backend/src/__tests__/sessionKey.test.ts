import { describe, it, expect } from 'bun:test';
import { deriveSessionKey } from '../utils/sessionKey.js';

describe('deriveSessionKey', () => {
  it('returns a 32-byte buffer', () => {
    const key = deriveSessionKey('test-secret');
    expect(key).toBeInstanceOf(Buffer);
    expect(key.byteLength).toBe(32);
  });

  it('returns the same key for the same secret', () => {
    const key1 = deriveSessionKey('my-secret-key');
    const key2 = deriveSessionKey('my-secret-key');
    expect(key1).toEqual(key2);
  });

  it('returns different keys for different secrets', () => {
    const key1 = deriveSessionKey('secret-a');
    const key2 = deriveSessionKey('secret-b');
    expect(key1).not.toEqual(key2);
  });

  it('is deterministic across calls', () => {
    const key1 = deriveSessionKey('persistent-secret');
    const key2 = deriveSessionKey('persistent-secret');
    const key3 = deriveSessionKey('persistent-secret');
    expect(key1).toEqual(key2);
    expect(key2).toEqual(key3);
  });
});
