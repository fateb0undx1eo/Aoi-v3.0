import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { SESSION_COOKIE_NAME } from '../../constants/auth.js';
import { serializeCookie } from '../../utils/cookies.js';
import { requireAuth } from '../middleware/requireAuth.js';
import type { BotContext } from '../../types/index.js';
import type { AuthService } from '../../services/authService.js';
import type { GuildService } from '../../services/guildService.js';

export function createAuthRoutes({ authService, guildService }: { authService: AuthService; guildService: GuildService }): Router {
  const router = Router();

  function getOAuthErrorCode(error: unknown): string {
    const message = String((error as Record<string, any>)?.message ?? '').toLowerCase();
    if (message.includes('invalid_client')) return 'invalid_client';
    if (message.includes('invalid_grant')) return 'invalid_grant';
    if (message.includes('access_denied')) return 'access_denied';
    if (message.includes('oauth token exchange failed')) return 'oauth_token_exchange_failed';
    return 'authentication_failed';
  }

  router.get('/discord', (req: Request, res: Response) => {
    const state = req.query.state?.toString() ?? '';
    const redirectUri = req.query.redirect_uri?.toString() ?? '';
    const url = authService.getOAuthAuthorizeUrl(state, redirectUri);

    if (req.query.format?.toString() === 'json') {
      res.status(200).json({ url });
      return;
    }

    res.redirect(url);
  });

  router.get('/callback', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const code = req.query.code?.toString() ?? '';
      const redirectUri = req.query.redirect_uri?.toString() ?? '';
      const result = await authService.handleCallback(code, redirectUri);

      if (req.query.format?.toString() === 'cookie') {
        res.setHeader('Set-Cookie', authService.buildCookieString(result.sessionToken));
        res.status(200).json({ user: result.user });
        return;
      }

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

  router.get('/me', requireAuth(authService), (req: Request, res: Response) => {
    res.status(200).json({ user: req.user });
  });

  router.get('/debug', (_req: Request, res: Response) => {
    if (process.env.NODE_ENV === 'production') {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    const clientId = authService.env.oauth.clientId || '';
    const redirectUri = authService.env.oauth.redirectUri || '';

    res.status(200).json({
      oauth: {
        clientIdPresent: Boolean(clientId),
        clientIdPreview: clientId ? `${clientId.slice(0, 4)}...${clientId.slice(-4)}` : null,
        clientSecretPresent: Boolean(authService.env.oauth.clientSecret),
        redirectUri: redirectUri || null
      }
    });
  });

  router.get('/guilds', requireAuth(authService), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const discordGuilds = await authService.fetchUserGuilds((req.auth as Record<string, any>).accessToken);
      const guildIds = discordGuilds.map((guild: Record<string, any>) => guild.id);
      const installedGuilds = await guildService.getGuildSnapshots(guildIds);
      const installedMap = new Map(installedGuilds.map((guild: Record<string, any>) => [guild.id, guild]));

      const guilds = discordGuilds
        .map((guild: Record<string, any>) => {
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
        .sort((left: Record<string, any>, right: Record<string, any>) => {
          if (left.installed !== right.installed) return left.installed ? -1 : 1;
          return left.name.localeCompare(right.name);
        });

      res.status(200).json({ guilds });
    } catch (error) {
      next(error);
    }
  });

  router.post('/session', (req: Request, res: Response) => {
    const sessionToken = (req.body as Record<string, any>)?.sessionToken?.toString?.() ?? '';
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

  router.post('/logout', (_req: Request, res: Response) => {
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
