# Police Balance Free Session

Date: 2026-05-05

## Status

Verdict: good for MVP free session.

The free-mode police config now creates early readable pressure without punishing quiet play. Normal active play gets warning feedback around minute 16, aggressive play creates pending raids, dirty cash becomes a real seizure risk, and hot district heat contributes to aggregate pressure. Pending raids are capped at one open raid and the 30 minute cooldown prevents tick spam.

War mode was not retuned. It still uses the shared base police config.

## Current Free Police Config

Effective free values:

| Field | Value | Free-session meaning |
| --- | ---: | --- |
| `districtHeatWeight` | `0.9` | District heat strongly contributes without fully overpowering player heat. |
| `highPressureRaidThreshold` | `115` | Real pending raids start after sustained/aggressive pressure. |
| `extremePressureRaidThreshold` | `180` | Extreme raids are for snowball/aggressive pressure. |
| `districtTargetHeatThreshold` | `70` | Raids target a specific district only when it is clearly hot. |
| `raidCooldownTicks` | `360` | 30 minutes at free tick rate; prevents raid spam. |
| `pendingRaidTtlTicks` | `12` | 1 minute warning before auto-resolve. |
| `maxPendingRaidsPerPlayer` | `1` | No duplicate unresolved pending raids. |
| `raidSeverityThresholds` | low `0`, medium `30`, high `115`, extreme `180` | Medium is warning-only. High/extreme create pending raid. |
| `dirtyCashSeizurePercentBySeverity` | low `0`, medium `5%`, high `12%`, extreme `22%` | Dirty cash matters, but one raid does not wipe the player. |
| `resourceSeizurePercentBySeverity` | low `0`, medium `0`, high `5%`, extreme `10%` | Contraband/resource loss is noticeable, not fatal. |
| `lockdownTicksBySeverity` | low `0`, medium `0`, high `12`, extreme `24` | Targeted lockdown lasts 1-2 minutes. |
| `buildingDisruptionTicksBySeverity` | low `0`, medium `0`, high `6`, extreme `18` | Building disruption now uses its own configured duration. |
| `heatReductionBySeverity` | low `0`, medium `8`, high `30`, extreme `55` | Raids cool player heat after punishment. |

Tick math:

- Free tick rate: `5000ms`.
- 1 minute: `12` ticks.
- 1 hour: `720` ticks.
- 2 hour free session: `1440` ticks.

## What Changed

Free mode now overrides police balance instead of changing shared base config:

- Medium warning threshold lowered from `60` to `30`.
- High raid threshold raised from `100` to `115`.
- Extreme threshold raised from `140` to `180`.
- District heat weight tuned from base `1` to free `0.9`.
- District targeting threshold raised from `60` to `70`.
- Raid cooldown raised from `4` ticks to `360` ticks.
- Pending raid TTL raised from `2` ticks to `12` ticks.
- Seizure percentages lowered for high/extreme raids.
- Lockdown/disruption durations raised to visible but short free-session windows.
- Police event copy shortened and made clearer.
- Bugfix: building disruption duration now respects `buildingDisruptionTicksBySeverity` instead of inheriting lockdown duration.

## Simulation Results

Simulation file: `tests/unit/game-core/police-free-session-simulation.test.ts`.

All scenarios run for `1440` ticks / 120 minutes with deterministic action schedules.

| Scenario | First warning | First pending raid | Max risk | Pending/resolved raids | Dirty seized | Resources seized | Lockdowns | Final owned districts |
| --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| Quiet Builder | none | none | low | 0 / 0 | 0 | 0 | 0 | 1 |
| Normal Player | 16 min | none | medium | 0 / 0 | 0 | 0 | 0 | 1 |
| Aggressive Raider | 12 min | 36 min | extreme | 3 / 3 | 7024 | 26 | 1 | 7 |
| Dirty Money Stacker | 20 min | 80 min | high | 2 / 2 | 10168 | 1 | 0 | 2 |
| Hot District Owner | none | 0 min | high | 4 / 4 | 1147 | 1 | 4 | 4 |
| Snowball Leader | 10 min | 30 min | extreme | 3 / 3 | 12650 | 69 | 1 | 8 |

Important observations:

- Quiet Builder stays below medium threshold: max aggregate pressure `9`.
- Normal Player reaches warning pressure, not raid pressure: max aggregate pressure `71`.
- Aggressive Raider reaches real police enforcement: max aggregate pressure `335`.
- Dirty Money Stacker loses meaningful dirty cash but remains playable.
- Hot District Owner proves district heat affects aggregate pressure and district targeting.
- Snowball Leader is slowed by heat reduction/seizures, but keeps non-negative resources and map progress.
- Max open pending raids stayed at `1` in every scenario.

## Balance Assertions

Covered:

- Quiet Builder: no high/extreme raid, no pending raid.
- Normal Player: warning appears during early free session, no destructive penalties.
- Aggressive Raider: high/extreme risk, pending raid, resolved raid, real consequences.
- Dirty Money Stacker: dirty cash seizure happens and does not wipe balances.
- Hot District Owner: `districtHeatPressure` exceeds player heat, `hottestDistrictId` is set, raid targets hot district.
- Snowball Leader: police reduces heat/seizes resources, no negative values, no NaN, no duplicate open pending raids.
- War mode separation: free police config does not overwrite war/base defaults.

## PoliceReadModel / UI

Core `PoliceReadModel` already exposes:

- `heat`
- `wantedLevel`
- `riskTier`
- `aggregatePressure`
- `playerHeatPressure`
- `districtHeatPressure`
- `hottestDistrictId`
- `hottestDistrictHeat`
- `pendingRaid`
- `previewConsequences`
- `lastPoliceEvent`
- `policeFeed`
- `recommendedAction`

Runtime bridge now passes hottest district data through to the UI. The police feed shows total pressure, player pressure, district pressure and hottest district. Legacy fallback remains only for sessions missing a core read model.

## Player Impact

- Quiet production and low-noise building play should not trigger raids.
- Normal active free play gets the first warning around 10-20 minutes; the simulation hits minute 16.
- First real raid usually requires aggressive expansion, dirty cash stacking or hot district ownership.
- A high raid can seize 12% dirty cash and 5% unprotected resources.
- An extreme raid can seize 22% dirty cash and 10% unprotected resources.
- Cash, population and gang members remain protected.
- Players reduce risk by pausing noisy attacks, cleaning/using dirty cash, and avoiding very hot district stacks.

## Tests

Passed during sprint:

- `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\unit\game-core\police-free-session-simulation.test.ts tests\unit\game-core\core-police-system.test.ts tests\unit\runtime-police-bridge.test.js tests\read-models\police-read-model.test.ts`
- `npm run typecheck`
- `npm run smoke:ui`
- `npm run lint:architecture`
- `npm run lint:file-sizes`

Known test note: npm prints a deprecated global/local config warning in this environment, but the commands pass.

## Next Prompt

Recommended next sprint prompt:

`Proveď FREE SESSION MANUAL UX PASS pro Empire Streets: spusť lokální hru, projdi celý free loop v browseru, ověř onboarding, police feed, pending raid, battle report a map refresh, oprav pouze UI no-crash/flow bugy bez změny gameplay balance.`
