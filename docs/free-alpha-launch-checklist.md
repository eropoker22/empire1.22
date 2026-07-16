# Free Alpha Launch Checklist

This checklist is for a public Free alpha/fun test. War mode must stay closed/founders until production persistence, session security, map size, and balance are ready.

## A) Local Test

- Use Node 20.
- Install dependencies with `npm ci` when lockfile state is clean; otherwise use `npm install` only for local repair.
- Run `npm run lint`.
- Run `npm run typecheck`.
- Run `npm test`.
- Run `npm run test:e2e:smoke`.
- Run `npm run build:admin:page`.
- Before larger balance changes, run `npm run test:simulation` or the relevant slow simulation target.
- Verify login -> lobby -> faction -> game.
- Verify spawn selection.
- Verify the first server-authoritative action.
- Verify War server remains closed.
- Verify onboarding storage key `empire:onboarding:v1` stores UI tutorial progress only, not gameplay state.

## B) Preview Deploy

- Confirm Netlify uses Node 20.
- Set preview environment variables without exposing secrets in logs.
- Verify `/api/servers`.
- Verify `/api/gameplay-slice/load`.
- Verify `/api/gameplay-slice/submit` through the Free flow.
- Verify login -> lobby -> faction -> game on the preview URL.
- Verify the admin monitoring endpoint requires its token.
- Verify War copy says preparing/founders/closed beta and no checkout exists.

## C) Production Deploy

- Required Netlify environment variables:
  - `NODE_ENV=production`
  - `EMPIRE_PERSISTENCE_DRIVER=postgres`
  - `EMPIRE_DATABASE_URL` or `GAMEPLAY_DATABASE_URL`
  - `GAMEPLAY_SLICE_SNAPSHOT_SECRET`
  - `GAMEPLAY_SLICE_SESSION_SECRET`
  - read-only admin session configuration described in `docs/admin/read-only-authority-foundation.md`
- Apply DB migrations:
  - `apps/server/src/runtime/persistence/postgres/migrations/001_initial_runtime_persistence.sql`
  - `apps/server/src/runtime/persistence/postgres/migrations/002_command_reservations.sql`
  - `apps/server/src/runtime/persistence/postgres/migrations/003_gameplay_identity_sessions.sql`
  - `apps/server/src/runtime/persistence/postgres/migrations/004_atomic_command_execution.sql`
- Verify production persistence is Postgres-backed.
- Verify production session repository is production-ready.
- Verify production does not start paid/War flows without production-ready account identity and gameplay sessions.
- Verify `/api/servers`.
- Verify `/api/gameplay-slice/load`.
- Verify spawn selection.
- Verify first server-authoritative action.
- Verify admin monitoring only works with the secret/token.
- Verify War server remains closed.

## D) After Launch

- Watch error logs for login, lobby, faction, load, submit, and spawn failures.
- Track rejected command error codes without logging session tokens, cookies, join tickets, snapshot tokens, DB URLs, or secrets.
- Check active player count and current tick in admin monitoring.
- Check recent commands and diagnostics for critical errors.
- Keep War mode closed until persistence, sessions, balance, and a larger validated War map are ready.
- Collect player feedback on first 5-10 minutes: spawn clarity, first district, first spy, first accepted action, and heat warnings.
