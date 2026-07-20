# Free Alpha Launch Checklist

This checklist is for a public Free alpha/fun test. War mode must stay closed/founders until production persistence, session security, map size, and balance are ready.

## Current launch decision: NO-GO for real players

The hosted runtime code now has local coverage for the previously blocking authority gaps:

- a cold gameplay Function reconstructs a known ready hosted server from its PostgreSQL control-plane record and latest snapshot without browser snapshot authority;
- hosted ticks and HTTP commands use the same per-instance atomic transaction boundary, while snapshot repositories reject stale or divergent equal-version writes;
- provisioning and lifecycle completion are fenced by the current worker claim, claim version, expiry, and the required runtime lease;
- production startup checks the exact migration filename/checksum contract and fails closed on missing, changed, extra, or unavailable migration history;
- `pages/game.html` enables visibility-aware gameplay polling every five seconds, with retry backoff after failures.

Do not invite real players yet. Registration and the final real-player account/gameplay-session entry boundary are intentionally deferred to the next phase. The Netlify Functions environment, target PostgreSQL migrations, production secrets, deployed route contracts, and a live hosted worker heartbeat have also not been proven on `empirestreets.cz`. Local tests are implementation evidence, not deployment evidence.

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
- Set preview environment variables through the Netlify UI, CLI, or API with Functions scope; do not rely on `[build.environment]` or values declared in `netlify.toml` for function runtime secrets.
- Set preview secrets without exposing them in build or function logs.
- Verify `/api/servers`.
- Verify `/api/account/session` returns JSON rather than the static 404 page.
- Verify `/api/lobby/overview` returns JSON rather than the static 404 page.
- Verify `/api/gameplay-slice/load`.
- Verify `/api/gameplay-slice/submit` through the Free flow.
- Verify all route families reach the same deployed function: `/api/account/*`, `/api/lobby/*`, `/api/gameplay-slice/*`, `/api/admin/*`, and `/api/servers`.
- Force a cold function start, then reconnect to an existing hosted match and verify the database-backed state and revision are restored before load or submit succeeds.
- Run two independent browser sessions and verify one player's accepted command appears in the other session without a manual refresh.
- Verify login -> lobby -> faction -> game on the preview URL.
- Verify the admin monitoring endpoint requires its token.
- Verify War copy says preparing/founders/closed beta and no checkout exists.

## C) Production Deploy

- Required Netlify Functions environment variables:
  - `NODE_ENV=production`
  - `EMPIRE_PERSISTENCE_DRIVER=postgres`
  - `GAMEPLAY_PERSISTENCE_DRIVER=postgres`
  - `EMPIRE_DATABASE_URL`
  - `GAMEPLAY_SLICE_SNAPSHOT_SECRET` with at least 32 characters
  - `GAMEPLAY_SLICE_SESSION_SECRET` with at least 32 characters and a different value from the snapshot secret
  - `EMPIRE_ALLOWED_ORIGINS=https://empirestreets.cz`
  - `EMPIRE_ADMIN_FINGERPRINT_SECRET` with at least 32 characters
  - `EMPIRE_ADMIN_WRITES_ENABLED=true`, `EMPIRE_HOSTED_CONTROL_PLANE_ENABLED=true`, and `EMPIRE_SERVER_PROVISIONING_ENABLED=true` only when production admin writes are intentionally opened
  - `EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED=false` unless an invite-only registration window is intentionally opened
  - `EMPIRE_CLOSED_ALPHA_INVITE_CODE_HASH` when closed-alpha registration is enabled
  - `EMPIRE_LEGACY_MATCHMAKING_ENABLED` unset or false
  - read-only admin session configuration described in `docs/admin/read-only-authority-foundation.md`
- Required hosted worker environment variables:
  - `NODE_ENV=production`
  - `EMPIRE_DATABASE_URL`
  - `EMPIRE_PERSISTENCE_DRIVER=postgres`
  - `GAMEPLAY_PERSISTENCE_DRIVER=postgres`
  - the same distinct `GAMEPLAY_SLICE_SESSION_SECRET` and `GAMEPLAY_SLICE_SNAPSHOT_SECRET`
  - `EMPIRE_HOSTED_WORKER_ID`, `EMPIRE_HOSTED_WORKER_REGION`, and `EMPIRE_BUILD_SHA`
- Configure these values in the Netlify UI, CLI, or API with Functions scope. Netlify does not expose environment variables declared in `netlify.toml` to Functions at runtime; see [Netlify Functions environment variables](https://docs.netlify.com/build/functions/environment-variables/).
- `EMPIRE_PUBLIC_ORIGIN` is not a substitute for `EMPIRE_ALLOWED_ORIGINS`; the production CSRF guard reads the allowlist.
- Apply DB migrations:
  - `apps/server/src/runtime/persistence/postgres/migrations/001_initial_runtime_persistence.sql`
  - `apps/server/src/runtime/persistence/postgres/migrations/002_command_reservations.sql`
  - `apps/server/src/runtime/persistence/postgres/migrations/003_gameplay_identity_sessions.sql`
  - `apps/server/src/runtime/persistence/postgres/migrations/004_atomic_command_execution.sql`
  - `apps/server/src/runtime/persistence/postgres/migrations/005_gameplay_identity_session_invariants.sql`
  - `apps/server/src/runtime/persistence/postgres/migrations/006_admin_read_only_control_plane.sql`
  - `apps/server/src/runtime/persistence/postgres/migrations/007_hosted_server_control_plane.sql`
  - `apps/server/src/runtime/persistence/postgres/migrations/008_hosted_join_reservations.sql`
  - `apps/server/src/runtime/persistence/postgres/migrations/009_player_entry_control_plane.sql`
  - `apps/server/src/runtime/persistence/postgres/migrations/010_runtime_instance_foreign_keys.sql`
  - `apps/server/src/runtime/persistence/postgres/migrations/011_hosted_runtime_lease_incarnation.sql`
- Run `npm run db:migrate:status` and reject the deploy unless every migration filename and checksum is current.
- Run strict hosted preflight with `EMPIRE_HOSTED_PREFLIGHT_STRICT=1`; a skipped database check is not a pass.
- Verify production persistence is Postgres-backed.
- Verify production session repository is production-ready.
- Verify production does not start paid/War flows without production-ready account identity and gameplay sessions.
- Verify `/api/servers`.
- Verify `/api/gameplay-slice/load`.
- Verify spawn selection.
- Verify first server-authoritative action.
- Verify admin monitoring only works with the secret/token.
- Verify War server remains closed.
- Re-run cold restore, serialized tick/command persistence, lifecycle/provisioning fencing, and cross-client polling against the deployed Function, target PostgreSQL, and live worker. Local regression coverage does not replace this production acceptance gate.
- Keep `EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED=false` until the real-player registration/session phase is implemented and explicitly approved.

## D) After Launch

- Watch error logs for login, lobby, faction, load, submit, and spawn failures.
- Watch cold-start restore failures, snapshot revision conflicts, tick lease conflicts, stale worker writes, and client update latency.
- Track rejected command error codes without logging session tokens, cookies, join tickets, snapshot tokens, DB URLs, or secrets.
- Check active player count and current tick in admin monitoring.
- Check recent commands and diagnostics for critical errors.
- Keep War mode closed until persistence, sessions, balance, and a larger validated War map are ready.
- Collect player feedback on first 5-10 minutes: spawn clarity, first district, first spy, first accepted action, and heat warnings.
