# Admin Dashboard MVP

`pages/admin.html` is the internal read-only admin dashboard for closed-alpha monitoring.

## Local run

Recommended local flow:

1. Start the server-authoritative local runtime with `npm run dev:game`.
2. Open `http://127.0.0.1:5174/admin`.

Notes:

- `npm run dev:admin` serves the static admin shell only. It does not provide `/api/admin/monitoring`.
- `npm run build:admin:page` regenerates the committed admin page and serverless build outputs.
- The dashboard reads `GET /api/admin/monitoring`.

## Admin guard

- Canonical env var: `EMPIRE_ADMIN_SECRET`
- Canonical request header: `x-empire-admin-secret`
- Production is fail-closed:
  - if `EMPIRE_ADMIN_SECRET` is missing, `/api/admin/monitoring` returns `403`
  - if the header is missing or wrong, `/api/admin/monitoring` returns `403`
- Non-production may omit the secret for local monitoring convenience.
- The secret is never accepted from query params.
- The secret is not written to `localStorage` or `sessionStorage`.
- The secret is not returned in any response body.

The current UI supports a minimal in-memory retry input after a `403`. The value stays only in page memory and is sent only in the request header. Production deployment still needs an explicit secret delivery mechanism from the hosting layer.

## What it shows

- Server overview:
  - `serverInstanceId`
  - `displayName`
  - `mode`
  - `region`
  - `status`
  - `playerCount`
  - `maxPlayers`
  - `currentTick`
  - `joinable`
  - `joinPolicy`
  - `health`
- Free / War status with a prominent `WAR CLOSED` badge
- Instance health:
  - healthy / unhealthy
  - warnings
  - warning count
  - `lastErrorAt`
  - `lastTickStartedAt`
  - `lastTickCompletedAt`
  - `queuedEventCount`
  - `crashCount`
- Recent commands, last 20 when available:
  - `commandId`
  - command type
  - actor / `playerId`
  - `tickAtReceive`
  - `receivedAt`
  - `correlationId`
  - status
- Recent diagnostics / errors, last 20 when available:
  - `level`
  - `category`
  - `message`
  - `occurredAt`
  - `commandId`
  - `correlationId`
- Snapshot / persistence info:
  - `lastSnapshotAt`
  - `snapshotSchemaVersion`
  - `diagnosticErrorCount`
  - `commandCount`
  - `eventCount`
  - `lastCrashAt`
- Closed-alpha checklist card

If command apply/reject status is not available from the current read-models, the dashboard shows `recorded`. Follow-up: surface applied/rejected from command results without widening admin authority.

## Read-only boundary

This MVP does not perform any write action.

Out of scope:

- player moderation
- economy/resource edits
- district ownership edits
- War open/close controls
- server restart
- command injection
- refunds
- spawn/debug actions

## Security filter

The dashboard must not display:

- session tokens
- cookies
- join tickets
- snapshot tokens
- database URLs
- secrets
- authorization headers
- raw env values
- passwords
- token hashes
- gameplay session raw tokens
- full connection strings

The admin payload is intentionally trimmed to safe operational metadata only.

## Closed-alpha dry run

1. Start local runtime: `npm run dev:game`.
2. Open `/admin`.
3. Open the Free flow as a test player.
4. Go through login and lobby.
5. Enter `game.html`.
6. Pick spawn through the UI.
7. Open one district popup.
8. Send one server-authoritative action.
9. In admin verify:
   - player count
   - current tick
   - recent command
   - health
   - diagnostics without critical error
10. Verify the `WAR CLOSED` badge.
11. Verify there are no admin write actions.
12. Verify there are no tokens or secrets in the UI.

## Closed-alpha status card

The checklist card currently reports:

- `verify:closed-alpha: PASSED`
- `E2E smoke: 14 passed`
- `Spawn UI: verified without API fallback`
- `War: closed`
- `Server action: verified`
- `Prod-like Postgres smoke: prepared, waiting for EMPIRE_TEST_DATABASE_URL`
- `Admin mode: read-only`
