const now = () => new Date().toISOString();

function log(level, message, meta = null) {
  const base = `[${now()}] [${level.toUpperCase()}] ${message}`;
  if (meta) {
    console.log(base, meta);
    return;
  }
  console.log(base);
}

export const logger = {
  info: (message, meta) => log('info', message, meta),
  warn: (message, meta) => log('warn', message, meta),
  error: (message, meta) => log('error', message, meta),
  debug: (message, meta) => {
    if (process.env.NODE_ENV === 'development') {
      log('debug', message, meta);
    }
  }
};
