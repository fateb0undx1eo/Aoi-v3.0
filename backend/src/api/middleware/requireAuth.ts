import type { FastifyRequest, FastifyReply } from 'fastify';
import { SESSION_COOKIE_NAME } from '../../constants/auth.js';
import { parseCookies } from '../../utils/cookies.js';

interface AuthServiceForMiddleware {
  readSessionToken(token: string): Record<string, any> | null;
}

export function requireAuth(authService: AuthServiceForMiddleware) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      if (
        process.env.NODE_ENV === 'development' &&
        String(process.env.DASHBOARD_DEV_BYPASS || '').toLowerCase() === 'true'
      ) {
        (request as any).user = { id: 'dev', username: 'dev', global_name: 'Dev' };
        (request as any).auth = { user: { id: 'dev', username: 'dev' } };
        return;
      }

      const cookies = parseCookies(request.headers.cookie || '');
      const bearer = request.headers.authorization?.startsWith('Bearer ')
        ? request.headers.authorization.slice(7)
        : '';
      const sessionToken = cookies[SESSION_COOKIE_NAME] || bearer;
      const session = authService.readSessionToken(sessionToken);

      if (!session) {
        reply.status(401).send({ error: 'unauthorized', message: 'No valid session found' });
        return;
      }

      (request as any).user = session.user;
      (request as any).auth = session;
    } catch {
      reply.status(401).send({ error: 'unauthorized', message: 'Invalid authentication' });
    }
  };
}
