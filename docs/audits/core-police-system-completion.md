# Core Police System Completion

Date: 2026-05-05

## Status

Status: ready for automated core/server/runtime checks; manual browser verification is still recommended.

The police source of truth is now core-first. Raid pressure, pending raid creation, acknowledgement, expiry and consequence application live in `packages/game-core` with config in `packages/game-config`. Browser runtime reads the core `PoliceReadModel` first and keeps the old heat/wanted derivation only as a legacy fallback.

Free-session balance follow-up: `docs/audits/police-balance-free-session.md` adds deterministic 120 minute simulations and a free-mode-only police override. War/base police defaults remain unchanged.

## Architecture Audit

- `packages/game-core/src/projections/police-read-model-projection.ts`
  - Existing: read-only heat/wanted projection.
  - Completed: unified `PoliceReadModel` with `heat`, `wantedLevel`, `riskTier`, `aggregatePressure`, `playerHeatPressure`, `districtHeatPressure`, hottest district fields, `pendingRaid`, `lastPoliceEvent`, `policeFeed`, and `recommendedAction`.
  - Rule: projection is read-only and does not mutate gameplay state.
- `packages/game-core/src/rules/police/triggerRaid.ts`
  - Existing: high player heat set `raid:pending`; no lifecycle or real consequences.
  - Completed: aggregate pressure trigger, warning-only medium state, high/extreme pending raid creation, duplicate/cooldown guard, district-targeted raid when district heat crosses threshold.
- `packages/game-core/src/rules/police/policePressure.ts`
  - New: authoritative aggregate pressure helper.
  - Model: `aggregatePressure = playerHeatPressure + districtHeatPressure * districtHeatWeight`.
- `packages/game-core/src/rules/police/raidConsequences.ts`
  - New: deterministic config-driven dirty cash/resource seizure, lockdown, building disruption and heat reduction.
- `packages/game-core/src/rules/police/raidPreview.ts`, `raidStateMutators.ts`, `raidTriggerHelpers.ts`, `policeConsequenceExpiry.ts`
  - New: small support modules split out to keep police rules under file-size limits.
- `packages/game-core/src/rules/police/raidLifecycle.ts`
  - New: `acknowledgePendingRaid`, `resolvePendingRaid`, `expirePendingRaids`, and expired lockdown/disruption release.
- `packages/shared-types/src/entities/police-state.ts`
  - Completed: persistent `PendingRaid` and `PoliceEvent` types on `PoliceState`.
- `packages/shared-types/src/views/police-read-model-view.ts`
  - New: frontend-safe `PoliceReadModel` contract.
- `packages/game-config/src/base/base-balance-config.ts`
  - Completed: `balance.police` config with trigger thresholds, TTL, cooldown, severity thresholds and penalties.
- `packages/game-config/src/base/base-police-config.ts`
  - New: extracted default police config to keep balance config inside file-size limits.
- `apps/server/src/runtime/projections/player-projection-service.ts`
  - Completed: server player projection passes config into core read model.
- `apps/server/src/runtime/projections/gameplay-slice-projection-service.ts`
  - Completed: gameplay slice exposes `player.police` and top-level `police`.
- `page-assets/js/app/runtime/policeHeatBridge.js`
  - Completed: core read model first, legacy heat fallback only.
- `page-assets/js/app/ui/policeFeedPanel.js`
  - Completed: displays pressure, pending raid preview and recommended action without applying penalties.

## Raid Trigger

Chosen model: aggregate pressure.

- `playerHeatPressure`: player police heat multiplied by `balance.policePressureMultiplier`.
- `districtHeatPressure`: sum of owned district heat.
- `aggregatePressure`: `playerHeatPressure + districtHeatPressure * balance.police.districtHeatWeight`.
- `low`: no raid.
- `medium`: warning event only.
- `high`: pending raid if no existing open raid and cooldown is clear.
- `extreme`: pending raid with extreme severity.
- District targeting: if hottest owned district heat is at least `districtTargetHeatThreshold`, the raid targets that district.
- Duplicate prevention: open `pending` or `acknowledged` raids count toward `maxPendingRaidsPerPlayer`.
- Spam prevention: `raidCooldownTicks` checks last created/resolved raid tick.
- `triggerRaid` returns per-player decisions: `no_raid`, `warning_only`, `pending_raid_created`, `existing_pending_raid_kept`, or `cooldown_active`.

## Raid Lifecycle

- `pending`: created by `triggerRaid` with `createdAtTick`, `expiresAtTick`, source pressure and preview consequences.
- `acknowledged`: command/rule marks the warning as seen. Ack does not prevent consequences.
- `resolved`: `resolvePendingRaid` applies consequences once and stores a police event.
- `expired`: if `autoResolveExpiredPendingRaids` is false, expired pending raids are marked expired without consequences.
- MVP default: expired pending raids auto-resolve on tick through `expirePendingRaids`.
- Resolved/expired raids are not applied a second time.

## Raid Consequences

Config location: `balance.police`.

- `dirtyCashSeizurePercentBySeverity`
- `resourceSeizurePercentBySeverity`
- `lockdownTicksBySeverity`
- `buildingDisruptionTicksBySeverity`
- `heatReductionBySeverity`
- `protectedResources`
- `maxSeizedPerRaid`

Applied consequences:

- Dirty cash seizure from player resource state.
- Resource seizure from non-protected resources.
- Target district `locked` state with `lockdownUntilTick`.
- Target district building `disabled` state with `disruptedUntilTick`; this now uses `buildingDisruptionTicksBySeverity` instead of inheriting lockdown duration.
- Heat reduction on the authoritative player police state.
- Police event appended to `policeEvents`.

Protected by default:

- `cash`
- `gang-members`
- `population`

Safety:

- No negative balances.
- No NaN values.
- No population/gang member seizure.
- Consequences are deterministic and testable.

## Runtime Boundary

Runtime no longer owns new police rules.

- Primary path: `PoliceReadModel` from `player.police` or top-level `police`.
- Legacy fallback: old browser heat/wanted derivation only when core read model is missing.
- Police feed receives aggregate pressure, player pressure, district pressure and hottest district data from the core read model.
- Runtime may acknowledge pending raids through a command callback if available; otherwise it dispatches a local UI fallback event.
- Runtime does not trigger raids, resolve raids or apply penalties.

## Free Balance Snapshot

Free mode uses a dedicated police override:

- Warning threshold: aggregate pressure `30`.
- High raid threshold: `115`.
- Extreme threshold: `180`.
- District heat weight: `0.9`.
- District target threshold: `70`.
- Raid cooldown: `360` ticks / 30 minutes.
- Pending raid TTL: `12` ticks / 1 minute.
- Dirty cash seizure: high `12%`, extreme `22%`.
- Resource seizure: high `5%`, extreme `10%`.

## Tests

Passed:

- `npm run typecheck`
- `npm run smoke:ui`
- `npm run lint:architecture`
- `npm run lint:file-sizes`
- `npm run test:unit` - 94 files, 348 tests.
- `npm run test:integration` - 14 files, 86 tests.
- `npm run test:read-models`
- `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\unit\game-core\core-police-system.test.ts tests\unit\runtime-police-bridge.test.js tests\unit\game-core\authoritative-gameplay-rules.test.ts`
- `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\integration\game-core\stabilization-critical-flow.test.ts`
- `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\unit\game-core\police-free-session-simulation.test.ts tests\unit\game-core\core-police-system.test.ts tests\unit\runtime-police-bridge.test.js tests\read-models\police-read-model.test.ts`

## Manual Checklist

1. Increase player heat.
2. Increase owned district heat.
3. Verify aggregate pressure.
4. Trigger pending raid.
5. Display pending raid in UI.
6. Acknowledge raid.
7. Resolve raid.
8. Verify dirty cash/resource seizure.
9. Verify lockdown/disruption.
10. Verify heat reduction.
11. Verify police feed.
12. Verify runtime uses core read model and legacy rules only as fallback.
