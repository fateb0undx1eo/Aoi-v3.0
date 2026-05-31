import log from 'loglevel';

const isDev = process.env.NODE_ENV === 'development';
log.setLevel(isDev ? 'debug' : 'warn');

export default log;
