declare namespace Express {
  interface Request {
    user?: Record<string, any>;
    auth?: Record<string, any>;
  }
}
