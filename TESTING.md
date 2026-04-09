# Testing Guide

## Manual Smoke Tests

Use this checklist after local changes.

### Backend Boot

1. Start `backend/`
2. Confirm the Discord client logs in
3. Confirm the API starts on `API_PORT`
4. Open `http://localhost:3001/healthz`

Expected:

- Discord login succeeds
- slash command sync does not throw
- `/healthz` returns `ok: true`

### Auth Flow

1. Start `landing/`
2. Open `http://localhost:3002/dashboard`
3. Click Discord login
4. Complete OAuth
5. Confirm you land on `/dashboard/servers`

Expected:

- landing uses `/api/auth/*` proxy routes
- backend sets the session cookie
- `/api/auth/me` returns the current Discord user after login

### Dashboard Data

1. Open a configured guild in the server picker
2. Verify the overview page loads
3. Verify module cards match the enabled backend modules
4. Verify settings and moderation pages load without auth errors

Expected:

- no stale redirect loops
- no 401s after a successful login
- unsupported pages are not linked as first-class surfaces

### Discord Runtime

Test a few real commands in Discord:

- moderation: `/warn`, `/mute`, `/cases`
- community: `/welcome`, `/leave`, `/boost`
- moderation utility: `/afk`, `/loa`

Expected:

- commands respond through deferred replies
- no `interaction already replied` failures
- config writes persist to the database

## Suggested Lightweight Automation

Until a real test suite exists, these are the highest-value checks to add next:

- backend module import smoke test
- API route smoke test for `/healthz` and auth middleware
- one moderation command happy path
- one community config command happy path
- one dashboard proxy test from landing to backend
