import { Router } from 'express';
import { SESSION_COOKIE_NAME } from '../../constants/auth.js';
import { serializeCookie } from '../../utils/cookies.js';
import { requireAuth } from '../middleware/requireAuth.js';

export function createAuthRoutes({ authService, guildService }) {
  const router = Router();

  function getOAuthErrorCode(error) {
    const message = String(error?.message ?? '').toLowerCase();
    if (message.includes('invalid_client')) return 'invalid_client';
    if (message.includes('invalid_grant')) return 'invalid_grant';
    if (message.includes('access_denied')) return 'access_denied';
    if (message.includes('oauth token exchange failed')) return 'oauth_token_exchange_failed';
    return 'authentication_failed';
  }

  router.get('/discord', (req, res) => {
    const state = req.query.state?.toString() ?? '';
    const redirectUri = req.query.redirect_uri?.toString() ?? '';
    const url = authService.getOAuthAuthorizeUrl(state, redirectUri);

    if (req.query.format?.toString() === 'json') {
      res.status(200).json({ url });
      return;
    }

    res.redirect(url);
  });

  router.get('/callback', async (req, res, next) => {
    try {
      const code = req.query.code?.toString() ?? '';
      const redirectUri = req.query.redirect_uri?.toString() ?? '';
      const result = await authService.handleCallback(code, redirectUri);
      res.status(200).json(result);
    } catch (error) {
      const errorCode = getOAuthErrorCode(error);
      if (errorCode !== 'authentication_failed') {
        res.status(401).json({ error: errorCode });
        return;
      }
      next(error);
    }
  });

  router.get('/me', requireAuth(authService), (req, res) => {
    res.status(200).json({ user: req.user });
  });

  router.get('/debug', (_req, res) => {
    const clientId = authService.env.oauth.clientId || '';
    const redirectUri = authService.env.oauth.redirectUri || '';
    const clientSecret = authService.env.oauth.clientSecret || '';

    res.status(200).json({
      oauth: {
        clientIdPresent: Boolean(clientId),
        clientIdPreview: clientId ? `${clientId.slice(0, 4)}...${clientId.slice(-4)}` : null,
        clientSecretPresent: Boolean(clientSecret),
        clientSecretLength: clientSecret.length || 0,
        redirectUri: redirectUri || null
      }
    });
  });

  router.get('/guilds', requireAuth(authService), async (req, res, next) => {
    try {
      const discordGuilds = await authService.fetchUserGuilds(req.auth.accessToken);
      const guildIds = discordGuilds.map((guild) => guild.id);
      const installedGuilds = await guildService.getGuildSnapshots(guildIds);
      const installedMap = new Map(installedGuilds.map((guild) => [guild.id, guild]));

      const guilds = discordGuilds
        .map((guild) => {
          const installed = installedMap.get(guild.id);
          return {
            id: guild.id,
            name: guild.name,
            icon: guild.icon,
            owner: guild.owner,
            permissions: guild.permissions,
            installed: Boolean(installed),
            member_count: installed?.stats?.member_count ?? null,
            boost_level: installed?.stats?.boost_level ?? null,
            updated_at: installed?.updated_at ?? null
          };
        })
        .sort((left, right) => {
          if (left.installed !== right.installed) return left.installed ? -1 : 1;
          return left.name.localeCompare(right.name);
        });

      res.status(200).json({ guilds });
    } catch (error) {
      next(error);
    }
  });

  router.post('/session', (req, res) => {
    const sessionToken = req.body?.sessionToken?.toString?.() ?? '';
    if (!authService.readSessionToken(sessionToken)) {
      res.status(401).json({ error: 'invalid_session_token' });
      return;
    }

    res.setHeader(
      'Set-Cookie',
      serializeCookie(SESSION_COOKIE_NAME, sessionToken, {
        maxAge: 7 * 24 * 60 * 60
      })
    );
    res.status(204).end();
  });

  router.post('/logout', (_req, res) => {
    res.setHeader(
      'Set-Cookie',
      serializeCookie(SESSION_COOKIE_NAME, '', {
        maxAge: 0
      })
    );
    res.status(204).end();
  });

  return router;
}
