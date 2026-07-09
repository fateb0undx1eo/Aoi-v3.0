import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { SESSION_COOKIE_NAME } from '../../constants/auth.js';
import { serializeCookie } from '../../utils/cookies.js';
import { requireAuth } from '../middleware/requireAuth.js';
import type { AuthService } from '../../services/authService.js';
import type { GuildService } from '../../services/guildService.js';

interface Deps {
  authService: AuthService;
  guildService: GuildService;
}

export async function authRoutes(instance: FastifyInstance, opts: { deps: Deps }): Promise<void> {
  const { authService, guildService } = opts.deps;

  function getOAuthErrorCode(error: unknown): string {
    const message = String((error as Record<string, any>)?.message ?? '').toLowerCase();
    if (message.includes('invalid_client')) return 'invalid_client';
    if (message.includes('invalid_grant')) return 'invalid_grant';
    if (message.includes('access_denied')) return 'access_denied';
    if (message.includes('oauth token exchange failed')) return 'oauth_token_exchange_failed';
    return 'authentication_failed';
  }

  instance.get('/discord', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string>;
    const state = query.state ?? '';
    const redirectUri = query.redirect_uri ?? '';
    const url = authService.getOAuthAuthorizeUrl(state, redirectUri);

    if (query.format === 'json') {
      return reply.status(200).send({ url });
    }

    reply.redirect(url);
  });

  instance.get('/callback', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as Record<string, string>;
      const code = query.code ?? '';
      const redirectUri = query.redirect_uri ?? '';
      const result = await authService.handleCallback(code, redirectUri);

      if (query.format === 'cookie') {
        reply.header('Set-Cookie', authService.buildCookieString(result.sessionToken));
        return reply.status(200).send({ user: result.user });
      }

      return reply.status(200).send(result);
    } catch (error) {
      const errorCode = getOAuthErrorCode(error);
      if (errorCode !== 'authentication_failed') {
        return reply.status(401).send({ error: errorCode });
      }
      throw error;
    }
  });

  instance.get('/me', { preHandler: requireAuth(authService) }, async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send({ user: (request as any).user });
  });

  instance.get('/debug', async (request: FastifyRequest, reply: FastifyReply) => {
    if (process.env.NODE_ENV === 'production') {
      return reply.status(404).send({ error: 'not_found' });
    }

    const clientId = authService.env.oauth.clientId || '';
    const redirectUri = authService.env.oauth.redirectUri || '';

    return reply.status(200).send({
      oauth: {
        clientIdPresent: Boolean(clientId),
        clientIdPreview: clientId ? `${clientId.slice(0, 4)}...${clientId.slice(-4)}` : null,
        clientSecretPresent: Boolean(authService.env.oauth.clientSecret),
        redirectUri: redirectUri || null
      }
    });
  });

  instance.get('/guilds', { preHandler: [requireAuth(authService)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const auth = (request as any).auth;
    const discordGuilds = await authService.fetchUserGuilds(auth.accessToken);
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

    return reply.status(200).send({ guilds });
  });

  instance.post('/session', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, any>;
    const sessionToken = body?.sessionToken?.toString?.() ?? '';
    if (!authService.readSessionToken(sessionToken)) {
      return reply.status(401).send({ error: 'invalid_session_token' });
    }

    reply.header(
      'Set-Cookie',
      serializeCookie(SESSION_COOKIE_NAME, sessionToken, {
        maxAge: 7 * 24 * 60 * 60
      })
    );
    return reply.status(204).send();
  });

  instance.post('/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    reply.header(
      'Set-Cookie',
      serializeCookie(SESSION_COOKIE_NAME, '', {
        maxAge: 0
      })
    );
    return reply.status(204).send();
  });
}
