import { describe, it, expect, beforeAll } from 'bun:test';
import crypto from 'node:crypto';
import { AuthService } from '../services/authService.js';
import type { EnvConfig } from '../types/env.js';

const createMockEnv = (secret: string): EnvConfig => ({
  nodeEnv: 'test',
  apiPort: 0,
  discord: {
    token: 'mock-token',
    clientId: 'mock-client-id',
    guildId: null,
    publicKey: null,
    domainExpansionRoleId: '',
    accusedRoleId: '',
  },
  oauth: {
    clientId: 'mock-oauth-id',
    clientSecret: 'mock-oauth-secret',
    redirectUri: 'http://localhost:3002/api/auth/callback',
  },
  session: {
    secret,
  },
  frontend: {
    url: 'http://localhost:3002',
    corsAllowedOrigins: ['http://localhost:3002'],
  },
  supabase: {
    url: 'https://mock.supabase.co',
    serviceRoleKey: 'mock-service-role-key',
    anonKey: 'mock-anon-key',
  },
  reddit: {
    clientId: '',
    clientSecret: '',
    userAgent: '',
  },
  redis: {
    url: 'redis://localhost:6379',
  },
});

describe('AuthService', () => {
  let authService: AuthService;

  beforeAll(() => {
    authService = new AuthService(createMockEnv('test-session-secret'));
  });

  describe('createSessionToken / readSessionToken', () => {
    it('creates a token that can be read back', () => {
      const session = { user: { id: '123', username: 'test' }, accessToken: 'tok_abc' };
      const token = authService.createSessionToken(session);
      const decoded = authService.readSessionToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded!.user.id).toBe('123');
      expect(decoded!.accessToken).toBe('tok_abc');
    });

    it('returns null for an invalid token', () => {
      const decoded = authService.readSessionToken('invalid-token-format');
      expect(decoded).toBeNull();
    });

    it('returns null for a tampered token', () => {
      const session = { user: { id: '123', username: 'test' }, accessToken: 'tok_abc' };
      const token = authService.createSessionToken(session);
      const parts = token.split('.');
      const tampered = `${parts[0]}.${parts[1]}.invaliddata`;
      const decoded = authService.readSessionToken(tampered);
      expect(decoded).toBeNull();
    });

    it('returns null for expired sessions', () => {
      const expired = {
        user: { id: '123', username: 'test' },
        accessToken: 'tok_abc',
        expiresAt: Date.now() - 1000,
      };
      const token = authService.createSessionToken(expired);
      const decoded = authService.readSessionToken(token);
      expect(decoded).toBeNull();
    });
  });

  describe('createSessionToken / readSessionToken with different auth service (different secret)', () => {
    it('cannot decrypt tokens from another service instance', () => {
      const service1 = new AuthService(createMockEnv('secret-a'));
      const service2 = new AuthService(createMockEnv('secret-b'));

      const session = { user: { id: '123', username: 'test' }, accessToken: 'tok_abc' };
      const token = service1.createSessionToken(session);
      const decoded = service2.readSessionToken(token);
      expect(decoded).toBeNull();
    });
  });

  describe('buildCookieString', () => {
    it('includes HttpOnly, SameSite=Lax, Path=/, and Secure', () => {
      const session = authService.buildSession(
        { id: '123', username: 'test', discriminator: '0', avatar: null, email: null },
        'tok_abc'
      );
      const cookie = authService.createSessionCookieString(session);
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Path=/');
      expect(cookie).toContain('Secure');
    });

    it('uses __Host- prefix', () => {
      const session = authService.buildSession(
        { id: '123', username: 'test', discriminator: '0', avatar: null, email: null },
        'tok_abc'
      );
      const cookie = authService.createSessionCookieString(session);
      expect(cookie).toMatch(/^__Host-aoi_session=/);
    });
  });

  describe('buildSession', () => {
    it('sets expiration to 7 days from now', () => {
      const now = Date.now();
      const session = authService.buildSession(
        { id: '123', username: 'test', discriminator: '0', avatar: null, email: null },
        'tok_abc'
      );
      expect(session.expiresAt - session.issuedAt).toBe(7 * 24 * 60 * 60 * 1000);
      expect(session.issuedAt).toBeGreaterThanOrEqual(now);
    });
  });
});
