# Admin Dashboard / Operations Console v1

`pages/admin.html` is currently a standalone static mock of the internal read-only Operations Console for Empire Streets DEMO/STAGING monitoring.

The dashboard is intentionally not a source of gameplay authority. It reads admin-safe projections, shows staging-only draft tools, and keeps future write controls disabled until the server-authoritative admin command model, persistence, sessions, roles, audit log, and transaction boundaries exist.

## Current Architecture Audit

| Area | Current file / endpoint | Works now | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| Static admin page | `pages/admin.html` | Renders mock Operations Console data directly in HTML | Static mock can drift from live read models | Keep mock values clearly marked and editable |
| Admin bundle | `apps/admin/src/browser/admin-page.ts`, `vite.admin-page.config.ts` | Builds to `page-assets/js/admin-assets/admin-app.js`, but is not mounted by the static mock page | Generated asset drift if promoted back to live UI | Use `npm run build:admin:page` after admin app source changes |
| App composition | `apps/admin/src/app/create-admin-app.ts` | Fetches read-only monitoring, falls back to read facades | Must not wire gameplay state directly | Keep using admin read services/facades |
| UI renderer | `apps/admin/src/pages/instance-list-page.ts` | Renders Operations Console v1 sections | UI could imply write authority | Every future write control is disabled with a reason |
| Admin read model | `apps/admin/src/read-models/*` | Builds UI-safe presentation models | Must not import `game-core` | Keep read-models projection-only |
| Monitoring endpoint | `GET /api/admin/monitoring` via `apps/server/src/netlify/admin-monitoring-netlify.ts` | Returns server summaries, health, recent commands/events/diagnostics | Payload can only be as safe as its projection | Keep payload trimmed and sanitized |
| Auth guard | `EMPIRE_ADMIN_SECRET`, `x-empire-admin-secret` | Production fails closed; query-string secrets ignored | Secret delivery still deployment-specific | Keep header-only and never persist secret in browser storage |
| Server admin commands | `apps/server/src/admin/admin-command-service.ts` | Existing server-side boundary for lifecycle operations | Not exposed as safe audited production write flow | Do not add live write UI until audit/roles/transactions exist |
| Tests | `tests/read-models`, `tests/server` | Guard/read-model coverage exists | E2E is expensive | Use targeted admin tests plus requested release gate |

## Admin v1 Scope

### Must Have Now

- Read-only instance/server health.
- DEMO/STAGING/runtime marker.
- Test/build gate placeholder and operational notes.
- Players/testers aggregate view when only aggregate data is available.
- Map/district aggregate preview with explicit projection gaps.
- Resources/economy, production/craft, heat/police and orders/missions sections marked read-only/projection-pending when data is not exposed.
- Recent events/logs/diagnostics with sanitized display.
- Known limitations and operator checklist.

### Nice To Have Now

- Server preset builder as draft-only JSON.
- Starting resources preset preview.
- Map preset preview.
- Export JSON draft.
- Message composer mock with disabled send.

### Future Server-Only

These are visible but disabled:

- Live server reset.
- Resource/money grants.
- District ownership edits.
- Player kick/ban/moderation.
- Live message broadcast.
- Event injection.
- Server phase changes.
- Cooldown or production manipulation.
- Map editing committed to server.
- War/season start.
- Economy interventions.

Every future write requires a server-authoritative admin command endpoint, role guard, audit log, dry-run, confirmation, expected state version, transaction boundary, and rollback/compensation notes.

## Information Architecture

Top bar:

- Environment badge: `DEMO / STAGING` or `STATIC PREVIEW`.
- Runtime marker.
- Server health hints.
- Last refresh time.
- Admin auth status.
- Free/War status badges.

Sidebar sections:

| Tab | Data source | Mode | Risk |
| --- | --- | --- | --- |
| Overview | Admin read model | Read-only | Low |
| Servers | Monitoring endpoint | Read-only | Low |
| Players | Aggregate monitoring until player projection exists | Read-only | Medium if IDs are misused as identity |
| Map | Server map aggregate / preview | Read-only/mock | Medium until district projection exists |
| Economy | Projection placeholder | Read-only | High if grants are enabled early |
| Production | Projection placeholder | Read-only | Medium until production projection exists |
| Police/Heat | Diagnostics plus projection placeholder | Read-only | Medium until heat projection exists |
| Orders/Missions | Recent command log only | Read-only | Medium because active state is not inferred |
| Events/Logs | Sanitized command/event/diagnostic records | Read-only | Low if raw payloads remain excluded |
| Presets | Local JSON draft | Mock | Low, no live mutation |
| Messages | Preview only | Locked | High if sent without audit |
| Future Controls | Disabled controls | Future server-only | High |
| Checklist | Static ops notes | Read-only | Low |

## Admin Data Model

`AdminDashboardReadModel` is the UI-facing v1 model. It contains:

- `AdminServerSummary`
- `AdminPlayerSummary`
- `AdminDistrictSummary`
- `AdminEconomySummary`
- `AdminProductionSummary`
- `AdminPoliceSummary`
- `AdminOrderSummary`
- `AdminEventSummary`
- `AdminPresetDraft`
- `AdminLockedControl`

The model must not contain:

- Secrets.
- Cookies.
- Authorization headers.
- Session tokens.
- Snapshot tokens.
- Raw DB URLs.
- Raw connection strings.
- Raw command payloads.

Any field that is not currently exposed by a safe projection is marked as projection pending rather than inferred from UI code.

## Read-Only Monitoring

The dashboard currently reads:

- Instance summaries.
- Server summaries.
- Health summaries.
- Recent command records.
- Recent event records.
- Recent diagnostic records.

It does not read or mutate gameplay state directly. It does not import `game-core` into the admin app.

## Safe Staging Preset Builder

The Presets tab creates a draft JSON object with:

- `name`
- `mode`
- `mapPreset`
- `startingCash`
- `startingDirtyCash`
- `startingPopulation`
- `startingMaterials`
- `startingWeapons`
- `heatStart`
- `enabledSystems`
- `notes`
- `draftOnly: true`

The draft can be exported. It is not applied to a live server. The disabled apply control documents the future requirements.

## Locked Future Controls

The dashboard renders the following disabled controls:

- Grant resources / money.
- Set district owner.
- Reset server instance.
- Start War season.
- Broadcast live message.
- Kick / ban player.
- Force cooldown resolve.
- Trigger city event.

Locked controls are not hidden because operators need to see the roadmap and the safety requirements. They are disabled because enabling them before server authority would create silent gameplay mutations.

## Security Model

- Production admin monitoring fails closed when `EMPIRE_ADMIN_SECRET` is missing.
- The canonical header is `x-empire-admin-secret`.
- Query-string secrets are ignored.
- The browser retry form keeps the secret only in page memory.
- The secret is not written to `localStorage` or `sessionStorage`.
- The secret is not returned in the response body.
- The UI must not show raw tokens, cookies, DB URLs, auth headers, or raw command payloads.
- Admin UI must not authorize gameplay actions by `playerId` or `accountId`.

## Sanitization Rules

The admin endpoint and UI redact secret-like text values in diagnostic/log display:

- `sessionToken=...`
- `snapshotToken=...`
- `adminToken=...`
- `authorization=...`
- `cookie=...`
- `password=...`
- `secret=...`
- `databaseUrl=...`
- `dbUrl=...`
- raw `postgres://...` / `postgresql://...`

This is defense-in-depth. The primary rule remains: raw payloads and secrets should not enter the admin read model.

## Future Admin Command Model

This is not implemented in demo v1. Future write admin must use a dedicated server-authoritative command endpoint.

```ts
interface AdminCommand<TType extends string, TPayload> {
  id: string;
  type: TType;
  actorAdminId: string;
  serverInstanceId: string;
  issuedAt: string;
  reason: string;
  payload: TPayload;
  expectedStateVersion: string;
  dryRun: boolean;
}
```

Future command types:

- `broadcast-server-message`
- `create-server-preset`
- `apply-server-preset`
- `reset-server-instance`
- `grant-player-resource`
- `set-starting-resources`
- `set-map-preset`
- `set-district-owner`
- `trigger-city-event`
- `moderate-player`
- `change-server-phase`

Every command requires:

- Auth role.
- Confirmation.
- Dry-run.
- Audit log.
- Idempotency key.
- Expected state version.
- Transaction boundary.
- Rollback or compensation notes.
- Tests for auth, audit, validation, idempotency and failure behavior.

## Real-Time Monitoring Roadmap

Admin v1 is safe with manual refresh and read-only fetches.

Future options:

- Polling every 10-30 seconds with a stale badge.
- SSE for event/log streams.
- WebSocket only after auth, rate limiting and reconnect/backoff are defined.
- Outbox/event log as the source of truth.
- Last-updated indicator.
- Stale data warning.

No real-time channel should perform write side effects.

## What Not To Implement Before Server Authority

- Direct gameplay state mutation from admin UI.
- Resource grants without server command/audit.
- District ownership edits without transaction and expected state version.
- Cooldown resolution tools.
- Production/craft manipulation.
- Live broadcast without command endpoint and audit.
- Player moderation without production identity/session/role model.
- Query-param admin auth.
- Any endpoint that exposes secrets, cookies, raw sessions, raw snapshot tokens, or DB URLs.

## Manual QA Checklist

1. Start local runtime with the admin endpoint available.
2. Open `/admin`.
3. Confirm the top bar shows DEMO/STAGING or STATIC PREVIEW.
4. Confirm Free/War badges are visible and War remains closed unless deliberately opened by server authority.
5. Confirm no future write control is enabled.
6. Confirm preset export downloads JSON and does not apply live.
7. Confirm message send is disabled.
8. Open a Free demo tester session and verify player count, tick, commands, events and diagnostics update.
9. Confirm no token, cookie, DB URL, auth header or raw command payload is displayed.
10. Check tablet/mobile readability manually before the first 5-10 tester run.
