# Deep Gameplay and Product Audit

Date: 2026-07-15

Scope: current dirty `main` worktree, static `local-demo`, server-authoritative core, commands, read models, building actions, production, economy, social systems, police, events, modals and repository hygiene.

## Verdict

Empire Streets is a broad and playable pre-alpha with unusually strong typed configuration and focused domain coverage. It is ready for continued local gameplay testing. It is not ready for a public multiplayer test yet.

The main risk is no longer missing recipe data. The main risk is that the static browser runtime and the server-authoritative slice still implement overlapping views of the same game. The repository correctly fails closed in several places, but some surfaces still show demo or mock data when no authoritative read model exists.

## Verified Foundations

- Gameplay load and submit derive authority from a validated gameplay session. A request `playerId` is checked against the session and a snapshot token is not used as identity.
- Pharmacy, Drug Lab, Factory and Armory canonical recipes, queues, storage-safe collect and Armory chain have focused tests.
- Visible building special actions are routed through `run-building-action`; production buildings do not expose a second production action in their detail card.
- Storage is configured per resource with Bulk, Tactical and Strategic groups.
- Strategic boosts have typed config and server command/read-model hooks.
- Market, police, alliance lifecycle, bounty, City Event config and production chain have focused domain tests.
- `local-demo`, `server-authoritative` and `unavailable` are explicit execution modes; non-development hosts do not silently default to local demo.

## P0 Before A Server Closed Alpha

### 1. Finish one UI authority per execution mode

`pages/game.html` loads the large static runtime and the generated server gameplay slice on the same page. The mode guards prevent many double mutations, but the page still contains two UI architectures.

Required:

- In `local-demo`, mount only local mutation bridges.
- In `server-authoritative`, render every gameplay surface from server read models and disable all local mutation code.
- In `unavailable`, render a clear unavailable state without demo data.
- Add one integration guard that enumerates all mutation entry points and proves that only one authority is enabled.

### 2. Remove nondeterministic canonical gameplay fallbacks

`packages/game-core/src/rules/heists/heistSystem.ts` still uses `Date.now()` and `Math.random()` for rolls, IDs and timestamps. Clinic/Recycling loss TTL helpers, district support projection and player boost projection also have wall-clock fallbacks.

Required:

- Pass logical tick and deterministic RNG through command/tick context.
- Snapshot all random inputs used by a long-running operation.
- Make command replay and repeated tick idempotent.
- Keep `Date.now()` only at transport/process boundaries, not in canonical rules or projections.

### 3. Connect server City Events to the existing modal

Typed config, commands, lifecycle and projection exist, but `city-events-runtime.js` only mutates local preview state and hides the launcher outside `local-demo`. No browser command bridge submits `start-city-event` or `claim-city-event-reward`.

Required:

- Render `player.cityEvents` in server mode.
- Submit only `offerId` or `pendingRewardId` through the gameplay command bridge.
- Refresh cash, Heat, storage, pending rewards and Street News from the command response.
- Keep the current local resolver only behind explicit `local-demo`.

### 4. Replace the mock leaderboard

`features/leaderboard.js` always combines the current player with `MOCK_PLAYERS`. It has no execution-mode guard and no authoritative leaderboard read model.

Required:

- Add a paged server leaderboard projection or mark the surface unavailable.
- Never show mock opponents in server-authoritative mode.
- Move Empire Score calculation to canonical core/server code.
- Keep mock rows only in an explicitly labelled developer fixture.

### 5. Finish production deployment dependencies

Production correctly fails closed without them, so the remaining work is operational rather than a client fallback:

- production account identity provider,
- durable gameplay session repository,
- live PostgreSQL verification,
- scheduled tick worker and multi-instance locking,
- reconnect/load/state-version conflict testing,
- rate limiting, audit logging and operational metrics.

## P1 Gameplay Hardening

### Heist and robbery

The public command path describes an immediate alpha heist, while the repository also contains a large asynchronous legacy heist system. This is two product models.

Decision required:

- Either keep the instant alpha result and delete unreachable async lifecycle code,
- or implement a persisted `pending -> resolved -> claimed` heist with deterministic snapshots.

Do not expose timers or multi-stage copy until the second option is authoritative and recoverable.

### Production local state

The static runtime has a shared local production-line model, but Factory still has a separate `production.factory.slots` and camel-case `inventory.factorySupplies` compatibility shape. Authority-state normalization can migrate canonical `metal-parts` and `tech-core` into that shape.

Required:

- Migrate existing demo snapshots once into canonical hyphen-key inventory.
- Use one local production state shape for all four buildings.
- Delete Factory-only supply and slot adapters after migration.
- Preserve queue reservations and local output during migration.

### Factions

Faction passive modifiers are implemented in core. The faction action modal, however, is a disabled future-feature button with copy such as "PŘIPRAVUJEME".

Required now:

- Replace the fake action button with a passive-effects summary.
- Show only effects that are actually applied by core.
- Add a special ability later only with config, command, cooldown, read model and tests.

### Alliances

The server lifecycle is substantial and local demo previews are correctly gated. Before multiplayer testing, verify contribution return and defense escrow races with persistence, not only in-memory tests. Demo chat and preview alliances must stay unavailable in server mode.

### Bounty

Server create/cancel and claim side effects exist. The remaining product gap is a clear history of claimed, expired and cancelled bounties and an explicit explanation of which combat outcome satisfies each objective.

### Police, Heat and Wanted

Core and read-model coverage is good. Remaining work:

- persist and replay pending raids across process restart,
- show one canonical explanation of aggregate pressure versus player/district Heat,
- ensure acknowledge never sounds like prevention,
- load-test duplicate tick/resolve boundaries.

### Market and bazaar

Canonical market commands and price-floor tests exist. Before server testing:

- verify listing escrow and expiry with durable persistence,
- add transaction pagination/history,
- prevent mock seller/player rows in server mode,
- make unavailable tabs fail closed rather than offering a local transaction.

### City Feed

Use Street News as the single notification surface. Old market/heist rumor arrays and incomplete faction/alliance visibility metadata should be migrated into canonical feed events. Tactical Grid, private raids and inventory details must remain player scoped.

### Buildings

The 32-building action registry is currently consistent and targeted tests pass. Remaining gaps:

- keep passive buildings without fake actions,
- reconcile stale docs that still mention a future Data Center even though `data_center` is excluded from canonical buildings,
- update the Street Dealers audit: the current implementation has three real sale slots rather than the old placeholder action,
- test timed effects after reload and server restart, not only immediate command acceptance.

## P2 Product and Balance Decisions

- Define the exact Free-session end state: district-control victory, hard timeout and Final Lockdown presentation must form one understandable rule set.
- Decide offline protection and what can complete while a player is disconnected.
- Define abandoned-player and inactive-district cleanup.
- Add command rate limits and multi-account abuse rules for market, bounty, alliance chat, spy and attacks.
- Run economy simulations after City Events and market rewards stabilize; monitor source/sink ratios for clean cash, dirty cash and strategic components.
- Keep War mode private until it has its own map size, pacing simulation, persistence and load validation.

## UI and Popup Audit

`game.html` contains many independent overlays, confirmations and result dialogs. Adding more standalone popups will increase focus, scroll-lock and mobile layout defects.

### Consolidate before adding windows

Create reusable shells for:

- standard modal,
- confirmation dialog,
- result report,
- mobile bottom sheet,
- focus restore, Escape/backdrop close and scroll lock.

Migrate existing dialogs incrementally; do not redesign every surface at once.

### Windows worth adding or extending

1. **Operations center**: one non-authoritative overview of active production pieces, spy missions, City Events, raids and cooldown deadlines. Each row links to its owning building/mechanic; mutation remains in the original canonical flow.
2. **Pending deliveries inside SKLAD**: show City Event rewards, market returns and restorative refunds waiting for claim. This should be a section in the existing storage modal, not another popup.
3. **Rules/Codex**: concise contextual rules for Heat, Wanted, storage, production and combat. Values come from read models/config; do not hardcode balance paragraphs.
4. **Connection/session status**: a compact non-modal server state with reconnect/error action. Never cover the map with a technical overlay.
5. **Street News filters**: private, alliance and public categories in the existing feed instead of a second notification center.

### Remove or change

- Replace the faction future-action modal with real passive information.
- Keep the admin slice only as a query/storage-enabled developer tool; inject its DOM/CSS only in debug builds later.
- Hide Battle Royale/War surfaces when the selected public mode does not support them.
- Avoid separate confirmation markup per command once the shared dialog shell exists.

## Repository Cleanup Performed

Removed generated, unreferenced local artifacts:

- `artifacts/` test and simulation output,
- `debug.log`, temporary dev logs and root `tmp-*.png` screenshots,
- a 500 MB client ZIP,
- unreferenced local screenshots under `img/`.

Added ignore rules for these artifact classes.

Removed unreferenced facade modules that only re-exported `runtime.js` and had no imports, HTML hooks, package exports or build references:

- `page-assets/js/app/client-state.js`,
- `page-assets/js/app/debug-demo.js`,
- `page-assets/js/app/game-core-rules.js`,
- `page-assets/js/app/server-commands.js`.

Kept compatibility modules that are still reached through `app.js`, other pages, tests or explicit debug mode.

## Verification Snapshot

- Building action registry/bridge/flow: 112 targeted tests passed.
- Core production, storage, boosts, City Events, alliance, market, police, bounty, heist and Street Dealers: 154 targeted tests passed.
- TypeScript typecheck passed.
- Browser config, architecture, command-dispatch and file-size lint passed.
- `git diff --check` passed.
- Live browser visual inspection was not available in the current in-app browser environment, so responsive visual claims are intentionally not made here.
- Full test suite, simulations and E2E were not run because this audit changed only cleanup/docs and the targeted domain coverage was the proportional gate.

## Recommended Execution Order

1. Deterministic heist/time/RNG cleanup.
2. Server City Event UI bridge.
3. Authoritative leaderboard or fail-closed replacement.
4. One canonical local production snapshot shape and Factory migration.
5. Shared modal/focus/scroll shell.
6. Operations center and pending-delivery storage section.
7. Durable Postgres/session/tick deployment verification.
8. Economy and 20-player soak simulations.
9. Closed-alpha server E2E and reconnect/conflict testing.
