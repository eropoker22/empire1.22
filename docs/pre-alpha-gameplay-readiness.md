# Empire Streets Pre-Alpha Readiness

Last reviewed: 2026-07-13.

## Verdict

Empire Streets is suitable for local/demo iteration and internal closed-alpha engineering checks. It is not yet a production multiplayer game. The static Netlify build is explicitly marked `local-demo`; browser state must not be interpreted as server authority.

The repository also contains meaningful server-authoritative foundations: validated gameplay sessions, command handling, state versions, persistence interfaces, typed config, read models, storage capacity, production-line handlers, conflict rules, heat/police rules, alliances, and simulations. Those foundations do not by themselves make the static client a production deployment.

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

- Demo Events
- Demo chat and local alliance preview storage
- Strategic boost protocols with local-demo persistence and fail-closed server-authoritative hooks
- local production modal mutations
- selected legacy canvas previews

Their storage keys use the `empire:demo:` prefix where they persist state. They must close, hide, or refuse mutation in `server-authoritative` mode.

## Server Deployment Gaps

Before production multiplayer, the project still needs:

1. A production account identity provider and durable gameplay session repository.
2. Production deployment configuration that selects `server-authoritative` mode explicitly.
3. End-to-end replacement or server wiring for every remaining local-demo mutation surface.
4. Live Postgres verification using `EMPIRE_TEST_DATABASE_URL` in a controlled environment.
5. Load, reconnect, idempotency, state-version conflict, and multi-instance operational testing.
6. Product decisions and complete server contracts for demo-only City Events and global chat; strategic boosts already use the typed command/read-model boundary.
7. Continued review of robbery/heist depth, bounty claim semantics, raid timing, and long-running order UX.

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
- Run focused browser smoke with `npm run test:e2e:smoke` and all scenarios with `npm run test:e2e:full` when the main game flow changes.
- Live Postgres tests remain skipped unless `EMPIRE_TEST_DATABASE_URL` is supplied; a skip is not a production persistence verification.
