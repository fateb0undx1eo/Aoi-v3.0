import crypto from 'node:crypto';
import type { EnvConfig } from '../types/env.js';
import { deriveSessionKey } from '../utils/sessionKey.js';
import { SESSION_COOKIE_NAME } from '../constants/auth.js';

interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  email: string | null;
}

interface SessionData {
  user: DiscordUser;
  accessToken: string;
  issuedAt: number;
  expiresAt: number;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export class AuthService {
  public env: EnvConfig;
  private sessionKey: Buffer;

  constructor(env: EnvConfig) {
    this.env = env;
    this.sessionKey = deriveSessionKey(env.session.secret);
  }

  getRedirectUri(override: string = ''): string {
    return override || this.env.oauth.redirectUri;
  }

  getOAuthAuthorizeUrl(state: string = '', redirectUriOverride: string = ''): string {
    const redirectUri = this.getRedirectUri(redirectUriOverride);
    const params = new URLSearchParams({
      client_id: this.env.oauth.clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: 'identify guilds',
      state
    });

    return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string, redirectUriOverride: string = ''): Promise<TokenResponse> {
    const redirectUri = this.getRedirectUri(redirectUriOverride);
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: this.env.oauth.clientId,
        client_secret: this.env.oauth.clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri
      })
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json() as { error?: string };
      throw new Error(`OAuth token exchange failed: ${error.error || 'unknown'}`);
    }

    return tokenResponse.json() as Promise<TokenResponse>;
  }

  async fetchCurrentUser(accessToken: string): Promise<DiscordUser> {
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!userResponse.ok) {
      throw new Error('Failed to fetch user from Discord');
    }

    const user = await userResponse.json() as Record<string, any>;
    return {
      id: user.id,
      username: user.username,
      discriminator: user.discriminator,
      avatar: user.avatar,
      email: user.email
    };
  }

  async fetchUserGuilds(accessToken: string): Promise<any[]> {
    const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!guildsResponse.ok) {
      throw new Error('Failed to fetch guilds from Discord');
    }

    return guildsResponse.json() as Promise<any[]>;
  }

  createSessionToken(session: Record<string, any>): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.sessionKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(session), 'utf8'),
      cipher.final()
    ]);
    const tag = cipher.getAuthTag();

    return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
  }

  readSessionToken(token: string): Record<string, any> | null {
    try {
      const [ivRaw, tagRaw, encryptedRaw] = String(token || '').split('.');
      if (!ivRaw || !tagRaw || !encryptedRaw) return null;

      const iv = Buffer.from(ivRaw, 'base64url');
      const tag = Buffer.from(tagRaw, 'base64url');
      const encrypted = Buffer.from(encryptedRaw, 'base64url');
      const decipher = crypto.createDecipheriv('aes-256-gcm', this.sessionKey, iv);
      decipher.setAuthTag(tag);

      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
      const session = JSON.parse(decrypted);

      if (!session?.user?.id || !session?.accessToken) return null;
      if (session.expiresAt && Date.now() > session.expiresAt) return null;

      return session;
    } catch {
      return null;
    }
  }

  buildSession(user: DiscordUser, accessToken: string): SessionData {
    const now = Date.now();
    return {
      user,
      accessToken,
      issuedAt: now,
      expiresAt: now + 7 * 24 * 60 * 60 * 1000
    };
  }

  createSocketTicket(session: SessionData, guildId: string, ttlMs: number = 60 * 1000): string {
    const now = Date.now();
    return this.createSessionToken({
      user: session.user,
      accessToken: session.accessToken,
      guildId,
      scope: 'dashboard-overview',
      issuedAt: now,
      expiresAt: now + ttlMs
    });
  }

  readSocketTicket(token: string): Record<string, any> | null {
    const payload = this.readSessionToken(token);
    if (!payload || payload.scope !== 'dashboard-overview' || !payload.guildId) {
      return null;
    }

    return payload;
  }

  createLogsSocketTicket(session: SessionData, ttlMs: number = 60 * 1000): string {
    const now = Date.now();
    return this.createSessionToken({
      user: session.user,
      accessToken: session.accessToken,
      scope: 'logs',
      issuedAt: now,
      expiresAt: now + ttlMs
    });
  }

  readLogsSocketTicket(token: string): Record<string, any> | null {
    const payload = this.readSessionToken(token);
    if (!payload || payload.scope !== 'logs' || !payload.user?.id) {
      return null;
    }

    return payload;
  }

  async handleCallback(code: string, redirectUriOverride: string = ''): Promise<{ user: DiscordUser; sessionToken: string }> {
    const tokenData = await this.exchangeCodeForTokens(code, redirectUriOverride);
    const user = await this.fetchCurrentUser(tokenData.access_token);
    const session = this.buildSession(user, tokenData.access_token);

    return {
      user,
      sessionToken: this.createSessionToken(session)
    };
  }

  createSessionCookieString(session: SessionData): string {
    const token = this.createSessionToken(session);
    return this.buildCookieString(token);
  }

  buildCookieString(token: string, maxAge?: number): string {
    const parts: string[] = [
      `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
      'Path=/',
      'SameSite=Lax',
      'HttpOnly',
      'Secure',
      typeof maxAge === 'number' ? `Max-Age=${maxAge}` : `Max-Age=${7 * 24 * 60 * 60}`
    ];
    return parts.join('; ');
  }
}
