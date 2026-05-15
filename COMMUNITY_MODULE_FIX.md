# Community Module Visibility Fix

## Status Check Results
✅ Backend: Community module is fully loaded and configured
✅ Database: Community module is enabled for all guilds
✅ API: Community module is returned in `/api/dashboard/guild/{guildId}/overview`
✅ Frontend: Dashboard components are configured to show community module

## Why It's Not Showing (Likely Causes)

1. **Browser Cache** - The dashboard might be cached in your browser
2. **Next.js Build Cache** - Old build artifacts
3. **CDN Cache** - If deployed to production
4. **Specific Guild Config** - The module might be disabled for that specific guild

## Solutions

### Quick Fixes (Try These First)

#### 1. Clear Browser Cache
- Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- Or clear browser cache entirely
- Close and reopen the dashboard

#### 2. Rebuild Frontend
```bash
cd landing
npm run build
npm run dev
```

#### 3. Check Guild Configuration
Visit the API endpoint directly in your browser to verify the module is there:
```
https://{your-api}/api/dashboard/guild/1457403601080287294/overview
```

You should see `community` in the modules array.

### Comprehensive Fix

If the above don't work, run these scripts:

#### 1. Verify Backend Module Loading
```bash
cd backend
node test-module-load.js
```

#### 2. Verify API Module List
```bash
cd backend
node test-api-modules.js
```

#### 3. Ensure Community Module Enabled in Database
```bash
cd backend
node fix-community-module.js
```

### If Still Not Working

The `community.tsx` page exists at `landing/src/pages/dashboard/guild/[guildId]/community.tsx` and overrides the generic `[module].tsx`. 

Try removing this override to use the generic fallback that properly shows all modules:
```bash
mv landing/src/pages/dashboard/guild/[guildId]/community.tsx landing/src/pages/dashboard/guild/[guildId]/community.tsx.disabled
```

Then rebuild: `npm run build && npm run dev`
