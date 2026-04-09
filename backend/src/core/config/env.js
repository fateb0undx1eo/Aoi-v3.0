import dotenv from 'dotenv';

dotenv.config();

const oauthClientId = process.env.DISCORD_OAUTH_CLIENT_ID ?? process.env.DISCORD_CLIENT_ID ?? '';
const oauthClientSecret = process.env.DISCORD_OAUTH_CLIENT_SECRET ?? process.env.DISCORD_CLIENT_SECRET ?? '';
const frontendUrl = process.env.FRONTEND_URL ?? process.env.FRONTEND_APP_URL ?? '';
const corsAllowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? frontendUrl)
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const required = [
  'DISCORD_TOKEN',
  'DISCORD_CLIENT_ID',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY'
];

const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

if (!oauthClientId || !oauthClientSecret) {
  throw new Error(
    'Missing OAuth credentials: set DISCORD_OAUTH_CLIENT_ID and DISCORD_OAUTH_CLIENT_SECRET, or provide DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET.'
  );
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  apiPort: Number(process.env.API_PORT ?? 3001),
  discord: {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID,
    guildId: process.env.GUILD_ID ?? null,
    publicKey: process.env.DISCORD_PUBLIC_KEY ?? null,
    domainExpansionRoleId: process.env.DOMAIN_EXPANSION ?? '',
    accusedRoleId: process.env.ACCUSED_ROLE ?? ''
  },
  oauth: {
    clientId: oauthClientId,
    clientSecret: oauthClientSecret,
    redirectUri: process.env.DISCORD_OAUTH_REDIRECT_URI ?? ''
  },
  session: {
    secret:
      process.env.SESSION_SECRET ??
      process.env.DISCORD_OAUTH_CLIENT_SECRET ??
      process.env.DISCORD_TOKEN
  },
  frontend: {
    url: frontendUrl,
    corsAllowedOrigins
  },
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    anonKey: process.env.SUPABASE_ANON_KEY ?? ''
  },
  reddit: {
    clientId: process.env.REDDIT_CLIENT_ID ?? '',
    clientSecret: process.env.REDDIT_CLIENT_SECRET ?? '',
    userAgent: process.env.REDDIT_USER_AGENT ?? 'discord:aoisenpai:1.0 (by /u/Few-Plankton-4201)'
  }
};
