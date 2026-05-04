# Police System Readiness

Audit date: 2026-05-04

Scope: stabilize current server-authoritative direction before adding free-session MVP police features. This document maps existing heat, wanted, raid, and runtime wiring without changing gameplay balance.

## Current Server-Authoritative Pieces

### Where heat is created

- Building actions add heat in `packages/game-core/src/handlers/useBuildingAction.ts`.
  - The resolved action updates district heat.
  - The same heat delta updates the acting player's police state and wanted level.
- District attacks add heat in `packages/game-core/src/handlers/attackDistrict.ts`.
  - Combat heat comes from conflict balance (`attackHeatGain`) and is applied to both district heat and attacker police state.
- Passive fixed-building income adds district heat in `packages/game-core/src/rules/economy/collectIncome.ts`.
  - This currently updates district heat only.
  - It does not update player police state heat directly.
- Several dedicated building handlers can create police/audit consequences:
  - casino, exchange, arcade, clinic, recycling, power station, strip club, and related support handlers.
- Experimental/large subsystems also mutate police state:
  - `packages/game-core/src/rules/market/serverMarketSystem.ts`
  - `packages/game-core/src/rules/heists/heistSystem.ts`

### Wanted level

- `packages/game-core/src/handlers/playerPoliceState.ts` owns the basic player police state helpers.
- `resolveWantedLevel(heat)` is a simple capped heat-to-level mapping.
- `increasePlayerPoliceHeat(...)` creates or updates the player police state and recomputes wanted level.
- Building actions and attacks already use these helpers.

### Police pressure

- `packages/game-core/src/rules/police/evaluatePolicePressure.ts` can calculate aggregate pressure from:
  - player police heat
  - district heat
  - `policePressureMultiplier`
- This is useful for MVP readiness, but it is not currently the raid trigger source.

### Raid rules

- `packages/game-core/src/rules/police/triggerRaid.ts` checks player police states.
- Threshold is derived from `raidIntensityMultiplier`.
- When heat reaches the threshold, the rule:
  - flags `raid:pending`
  - raises wanted level to at least 5
  - emits a `police-raid-triggered` core event with a calculated raid result payload
- The rule does not currently apply raid consequences to resources, buildings, districts, or heat.

### Tick/server runtime wiring

- `packages/game-core/src/engine/tick.ts` calls:
  - `collectIncome`
  - `completeProduction`
  - `completeCraftProcessing`
  - `triggerRaid`
  - `checkVictory`
- `apps/server/src/runtime/scheduling/tick-runner.ts` runs `runTick(...)`, persists state, and enqueues core events.
- The tick runner publishes a tick-completed event, but police/core events are only enqueued through the event queue path. Free-session UI should not assume direct live police notifications until this is explicitly verified.

## Current Legacy Runtime Pieces

`page-assets/js/app/runtime.js` contains a browser-local police experience:

- gang heat state and heat journal
- wanted popup UI
- automatic heat pressure checks
- police action and raid result modals
- black-market dirty-trade heat
- police raid protection timing
- district police warning payloads

This is useful as UI reference, but it is not authoritative. MVP work should move behavior into core/server first, then project it into UI.

## Connected Today

- Attack flow is connected to player police heat and district heat.
- Building action flow is connected to player police heat and district heat.
- Passive building income is connected to district heat.
- Tick flow calls `triggerRaid`.
- District projections expose district heat.
- Conflict report projections expose heat gained from attacks.

## Not Ready Yet

- Passive district heat does not become player police heat, so passive heat alone may not trigger player raids.
- `evaluatePolicePressure` includes district heat, but `triggerRaid` does not use that aggregate pressure.
- `triggerRaid` creates pending raid state and an event, but does not apply gameplay consequences.
- There is no clear server command to resolve, acknowledge, or expire `raid:pending`.
- Player/read-model projection does not expose a complete wanted/police state for UI.
- Legacy police UI and server police rules are parallel systems with different state models.
- Market and heist police hooks exist but are not part of a simple free-session MVP command/tick contract.
- Server tick event publication should be verified before relying on live police notifications.

## MVP Gaps For Free Mode

1. Define a minimal authoritative police state view for the player panel: heat, wanted level, pending raid, and last police event.
2. Decide whether raids trigger from player heat only or aggregate police pressure. If aggregate pressure is desired, route `evaluatePolicePressure` into `triggerRaid` with tests.
3. Apply raid consequences in core, not browser runtime. Start with one narrow consequence set and keep balance values in config.
4. Add a command or tick rule to clear/resolve `raid:pending`.
5. Add integration tests for:
   - passive heat accumulation
   - attack heat to wanted level
   - building action heat to wanted level
   - raid threshold
   - raid resolution/expiration

## Safe PR Sequence

1. Add read-only police projection tests before changing behavior.
2. Expose current `policeStatesById` safely in the player/session view.
3. Add aggregate-pressure tests while keeping current trigger behavior unchanged.
4. Implement one raid resolution path with deterministic consequences and config-driven values.
5. Replace one legacy UI police calculation at a time with server-projected values.
