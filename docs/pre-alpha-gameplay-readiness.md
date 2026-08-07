# Empire Streets Pre-Alpha Readiness

Last reviewed: 2026-07-29.

## Verdict

Empire Streets has an explicit loopback-only `local-demo` for development and a separate
`server-authoritative` production path. The production client defaults to server authority and
must fail closed when the hosted API, account identity, gameplay session or persistence is not
production-ready. A hosted deployment still requires its environment and release gates to be
verified; browser demo state is never production authority.

The server path includes validated gameplay sessions, typed commands, state versions, PostgreSQL
persistence, recovery heads/checkpoints, hosted worker ownership and authoritative read models.
The polished district/building presentation is shared between modes, while its data and mutation
adapters remain explicitly separated.

## Current Player Loop

- choose or restore a starting district
- inspect and upgrade buildings
- run configured building actions
- produce and collect resources through Pharmacy, Drug Lab, Factory, and Armory
- manage per-item global storage limits
- trade through the current market surfaces
- spy, attack, occupy, defend, and respond to reports
- balance heat, wanted pressure, and police raids
- use alliance features where a real server lifecycle is available

War mode remains private/incomplete and is not a public gameplay promise.

## Production and Storage

All four manufacturing buildings use independent one-unit lines. Historical passive production and `produce_*` building actions are not current gameplay.

- Pharmacy produces Chemicals, Biomass, and Stim Pack.
- Drug Lab produces Neon Dust, Pulse Shot, Velvet Smoke, Ghost Serum, and Overdrive X.
- Factory produces Metal Parts, Tech Core, and Combat Module.
- Armory produces five attack weapons and five defense items.

Ghost Serum and Overdrive X are stored components, not directly usable boosts. Together with Pulse Shot and Combat Module they are consumed by Ghost Network, Industrial Overdrive, and Tactical Grid. Combat Module also remains a strategic input for SMG, Bazooka, and Defense Tower production.

Global storage is per resource:

- Bulk: 60 base per item
- Tactical: 24 base per item
- Strategic: 8 base per item

Active owned Warehouses increase capacity by count and highest active level. No item is deleted when capacity falls below current inventory. Power Stations do not change storage capacity.

## Explicit Demo-Only Systems

These browser systems are allowed only while execution mode is `local-demo`:

- Demo fixture data for City Events
- Demo chat and local alliance preview storage
- Strategic boost protocols with local-demo persistence and fail-closed server-authoritative hooks
- local production mutations behind the local-demo adapter
- selected legacy canvas previews

Their storage keys use the `empire:demo:` prefix where they persist state. They must close, hide, or refuse mutation in `server-authoritative` mode.

The City Events modal and the four production-building modals are shared presentation surfaces.
In `server-authoritative` mode they consume server read models and typed command responses; they do
not enable their local-demo mutation/storage adapters.

## Server Deployment Gaps

Before a production multiplayer opening, the project still needs:

1. Exact production deployment identity, TLS/origin, build SHA and secret gates.
2. A complete live PostgreSQL, recovery, reconnect and multi-instance operational gate.
3. Browser acceptance proving every exposed server surface stays authoritative and fail-closed.
4. Load, idempotency, state-version conflict and worker recovery testing at the intended scale.
5. A server contract or explicit production feature flag for remaining demo-only social previews,
   including global chat.
6. Continued review of robbery/heist depth, bounty claim semantics, raid timing, and long-running
   order UX.

Production must fail closed when identity, session, or gameplay authority is unavailable. Snapshot tokens never authorize load, submit, join, or logout.

## Risk Review

### High

- A local-demo surface accidentally enabled beside server authority could double-apply state. The centralized execution mode and guard tests must remain mandatory.
- Browser-generated compatibility config can drift if it is not regenerated. `npm run check:browser-config` blocks that drift.
- Full browser flows remain sensitive to server teardown and stale generated `client/` output.

### Medium

- `runtime.js` is still large and carries rendering plus demo compatibility responsibilities.
- Some markets and social previews have broader demo catalogs than current server handlers; server mode must hide or reject unsupported entries.
- Robbery/heist text and rules must stay aligned with the simpler active implementation.
- Long cooldowns require persistent, clear order and raid feedback.

### Controlled

- Typed production recipes, storage groups, Armory high-tier inputs, weapon power/population, and production queue caps have focused tests.
- Unknown storage-limited resources fail configuration/credit validation instead of becoming silently unlimited.
- Restorative refunds can create over-capacity inventory without deleting player-owned items.
- Session authority derives player identity from the validated gameplay session, not request `playerId`.

## Verification Strategy

- Use targeted unit/integration tests while iterating.
- Run `npm run typecheck`, `npm run lint`, and `npm test` for repository gates.
- Run deterministic simulations separately with `npm run test:simulation`.
- Run `npm run test:e2e:smoke` for public live entrypoints with deterministic API responses. It intentionally excludes guest/local-demo gameplay and onboarding fixtures; verify real login -> lobby -> faction -> game and authoritative actions in Hosted Acceptance and guarded staging acceptance. Keep `npm run test:e2e:full` as a non-release development inventory until every legacy scenario is migrated or retired.
- Live Postgres tests remain excluded from default suites; their explicit npm commands fail unless `EMPIRE_TEST_DATABASE_URL` is supplied, and a skipped direct-file run is not production persistence verification.
