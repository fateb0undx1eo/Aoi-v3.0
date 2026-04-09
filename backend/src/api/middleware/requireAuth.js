import { SESSION_COOKIE_NAME } from '../../constants/auth.js';
import { parseCookies } from '../../utils/cookies.js';

export function requireAuth(authService) {
  return (req, res, next) => {
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

      req.user = session.user;
      req.auth = session;
      next();
    } catch {
      res.status(401).json({ error: 'unauthorized', message: 'Invalid authentication' });
    }
  };
}
