import type { Request, Response, NextFunction } from 'express';
import { SESSION_COOKIE_NAME } from '../../constants/auth.js';
import { parseCookies } from '../../utils/cookies.js';

interface AuthServiceForMiddleware {
  readSessionToken(token: string): Record<string, any> | null;
}

export function requireAuth(authService: AuthServiceForMiddleware) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const cookies = parseCookies(req.headers.cookie || '');
      const bearer = req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice(7)
        : '';
      const sessionToken = cookies[SESSION_COOKIE_NAME] || bearer;
      const session = authService.readSessionToken(sessionToken);

      if (!session) {
        res.status(401).json({ error: 'unauthorized', message: 'No valid session found' });
        return;
      }

      (req as Record<string, any>).user = session.user;
      (req as Record<string, any>).auth = session;
      next();
    } catch {
      res.status(401).json({ error: 'unauthorized', message: 'Invalid authentication' });
    }
  };
}
