# Deployment

## Render (Recommended)

Create a **Web Service** connected to your Git repo.

### Settings

- **Runtime**: Node
- **Build Command**: `cd backend && npm install`
- **Start Command**: `cd backend && npm start`
- **Instance Type**: Starter or higher (the bot uses ~256MB+)

### Environment Variables

Set all variables from [QUICK_START.md](./QUICK_START.md) in the Render dashboard.

### Redis

Use Render's Redis add-on or Upstash. Set `REDIS_URL` accordingly.

### Health Check

The Express server listens on `PORT` (default `3001`). Render's health check pings `http://localhost:3001` automatically.

## Manual (VPS)

```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs git

# Clone & setup
git clone <repo>
cd aoi-v3/backend
cp .env.example .env   # edit with your values
npm install --production

# Run with process manager
npm install -g pm2
pm2 start src/main.js --name aoi-bot
pm2 save
pm2 startup
```

## Supabase

Run migrations or restore your database dump. Key tables:
- `module_configs` — all guild configurations
- `rate_limit_rules` — rate limiting
- `cases`, `afk_status`, `loa_status`, `ghost_pings` — moderation
- `auto_responses` — autoresponder entries
- `ticket_configs`, `ticket_audit_logs`, `ticket_cooldowns` — tickets
- `analytics_events` — analytics data

## Updating

```bash
git pull
cd backend && npm install
pm2 restart aoi-bot   # or redeploy on Render
```
