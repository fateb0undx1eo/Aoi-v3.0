import crypto from 'node:crypto';

export class AuthService {
  constructor(env) {
    this.env = env;
    this.sessionKey = crypto
      .createHash('sha256')
      .update(String(env.session.secret || 'discord-ecosystem-session'))
      .digest();
  }

  getRedirectUri(override = '') {
    return override || this.env.oauth.redirectUri;
  }

  getOAuthAuthorizeUrl(state = '', redirectUriOverride = '') {
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

  async exchangeCodeForTokens(code, redirectUriOverride = '') {
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
      const error = await tokenResponse.json();
      throw new Error(`OAuth token exchange failed: ${error.error || 'unknown'}`);
    }

    return tokenResponse.json();
  }

  async fetchCurrentUser(accessToken) {
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!userResponse.ok) {
      throw new Error('Failed to fetch user from Discord');
    }

    const user = await userResponse.json();
    return {
      id: user.id,
      username: user.username,
      discriminator: user.discriminator,
      avatar: user.avatar,
      email: user.email
    };
  }

  async fetchUserGuilds(accessToken) {
    const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!guildsResponse.ok) {
      throw new Error('Failed to fetch guilds from Discord');
    }

    return guildsResponse.json();
  }

  createSessionToken(session) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.sessionKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(session), 'utf8'),
      cipher.final()
    ]);
    const tag = cipher.getAuthTag();

    return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
  }

  readSessionToken(token) {
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

  buildSession(user, accessToken) {
    const now = Date.now();
    return {
      user,
      accessToken,
      issuedAt: now,
      expiresAt: now + 7 * 24 * 60 * 60 * 1000
    };
  }

  async handleCallback(code, redirectUriOverride = '') {
    const tokenData = await this.exchangeCodeForTokens(code, redirectUriOverride);
    const user = await this.fetchCurrentUser(tokenData.access_token);
    const session = this.buildSession(user, tokenData.access_token);

    return {
      user,
      sessionToken: this.createSessionToken(session)
    };
  }
}
