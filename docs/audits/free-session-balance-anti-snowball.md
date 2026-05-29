# Free Session Balance + Anti-Snowball

Date: 2026-05-06

## Scope

This sprint audited FREE mode pacing through deterministic core simulations. No attack math, spy math, capture logic, map geometry, UI layout, runtime calculations, server architecture, or onboarding flow was changed. No balance config change was required by the current assertions; the sprint adds repeatable coverage and documents the observed pacing.

Relevant test:

- `tests/unit/game-core/free-session-balance-anti-snowball.test.ts`

## Free Mode Balance Audit

| Value | Current FREE config | Assessment |
| --- | --- | --- |
| Tick length | `tickRateMs: 5000` | Fast enough for MVP free-session pacing. |
| Target session length | `gameDurationMs/sessionTtlMs: 2h` through mode runtime config | Matches requested 1-2 hour free-session target. |
| Max players | `20` | Ready for current map density. |
| Alliance size | `4` | Strong but checked by alliance push simulation. |
| Win condition | `final-lockdown`; district-control instant victory disabled | District control still increases score and position, but no longer resolves FREE mode by itself. |
| Starting resources | cash `1500`, dirty cash `300`, chemicals `10`, biomass `6`, metal parts `8`, tech core `2` | Supports first craft/action path without zero-resource lock. |
| Multipliers | income `1.2`, production `1.2`, cooldown `0.8`, expansion speed `1.3` | Free mode intentionally faster than war mode. |
| First collect timing | observed minute `2` for new player | Ready; target 1-3 minutes. |
| First craft timing | observed minute `6` for new player | Ready; target 5-10 minutes. |
| First spy timing | observed minute `10` for new player | Ready; target 10-20 minutes. |
| First attack timing | observed minute `12` for new player | Ready; target 10-20 minutes. |
| Spy config | cooldown `1` tick, base success `0.76`, trap reveal `0.2` | Fast enough for early scouting. |
| Attack config | cooldown `36` ticks, min duration `36` ticks, heat gain `8`, catastrophe `0.06` | Pacing is acceptable in simulation; per-target attack route should stay watched for snowball risk. |
| Police thresholds | warning/medium `30`, high raid `115`, extreme `180`, district target heat `70` | Creates warnings for normal/aggressive play and raids for aggressive/snowball. |
| Raid controls | cooldown `360` ticks, pending TTL `12`, max pending raids per player `1` | Prevents duplicate pending raid spam in simulations. |
| Raid penalties | dirty cash seizure `5/12/22%`, resource seizure `0/5/10%`, lockdown `0/12/24`, heat reduction `8/30/55` | Brakes heat leaders without wiping progress. |
| Core production | pharmacy `5 chemicals/tick`, factory `4 metal-parts/tick`, drug lab `2 neon-dust/tick` before FREE multiplier/supports | Ready for early craft path. |
| Apartment block | `2 population/min`, capacity `50`, manual collect | Ready; no income/heat by design. |
| Dirty cash sources | arcade `72/min`, casino `260/min`, exchange `95/min`, smuggling tunnel `62/min` | Dirty cash reward is meaningful. |
| Laundering actions | arcade back cashdesk, exchange good rate, casino quiet backroom | Reward/risk is visible through heat and police pressure. |
| Storage caps | warehouse generic `500`, chemicals `350`, biomass `350`, metal parts `400`, tech core `120`, drugs/boosts `220`, weapons/defense `160` | Meaningful cap in core; overflow stays capped by existing storage rules. |
| War-mode bleed check | war threshold remains separate from FREE endgame config in test | FREE changes are not accidentally treated as global. |

Ready: early growth, production/craft path, dirty-cash risk, police warning/raid pressure, alliance threshold sanity.

Suspiciously fast: alliance push can reach `65%` map control in 60 minutes under coordinated scripted pressure. This no longer ends a FREE match directly, but it still matters through Final Lockdown score and should be rechecked after live multiplayer tests.

Too slow: none in current simulation. Low-activity players collect/craft late by plan, but passive income prevents total collapse.

Snowball risk: medium. A leader with early districts reaches high cash/dirty-cash totals and strong pressure, but raids and pending caps trigger. The remaining risk is that attack cooldown is effectively route/target constrained by current command validation, not a global leader throttle.

Potential frustration: storage overflow UX remains a TODO from the building sprint; current core caps are safe, but player-facing clarity can improve later.

## Simulation Results

All scenarios use deterministic scripted plans over a 40 district test map with real core commands: production collect, armory craft, spy, attack, laundering/dirty-cash actions, `runTick`, `PoliceReadModel`, and city feed projection.

| Scenario | Minutes | First collect | First craft | First spy | First attack | First warning | First raid | Districts | Win progress | Heat | Police pressure | Raids resolved | Result |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| New Player 15 Minutes | 15 | 2 | 6 | 10 | 12 | n/a | n/a | 2 | 5% | 8 | 19 | 0 | Ready: early loop is reachable. |
| Normal Player 60 Minutes | 60 | 4 | 8 | 12 | 16 | 23 | n/a | 4 | 10% | 32 | 102 | 0 | Ready: grows and sees police warning without raid wall. |
| Aggressive Raider 60 Minutes | 60 | 3 | 6 | 6 | 9 | 12 | 27 | 11 | 27.5% | 13 | 346 | 2 | Ready: faster growth, higher police risk, not blocked. |
| Passive Builder 60 Minutes | 60 | 8 | 20 | n/a | n/a | n/a | n/a | 1 | 2.5% | 0 | 10 | 0 | Ready: safe growth, cannot win without conflict. |
| Snowball Leader | 60 | 2 | 4 | 5 | 6 | 7 | 19 | 12 | 30% | 45 | 494 | 2 | Medium risk: leader grows, pressure/raids brake but do not erase. |
| Alliance Push | 60 | 4 | 8 | 8 | 10 | 19 | 35 | 26 | 65% | 44 | 157 | 4 | Ready: strong push affects score but does not directly end the match. |
| Low Activity Player | 60 | 20 | 40 | n/a | n/a | n/a | n/a | 1 | 2.5% | 0 | 10 | 0 | Ready: falls behind on actions but keeps basic economy. |

Other observed end-state metrics:

| Scenario | Clean cash | Dirty cash | Crafted items | Successful attacks | City feed events | Most used action path |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| New Player | 5,993 | 2,452 | 1 | 1 | 4 | collect -> craft -> spy -> attack |
| Normal Player | 40,480 | 16,989 | 2 | 3 | 15 | collect, craft, spy/attack, exchange |
| Aggressive Raider | 151,266 | 76,076 | 2 | 9 | 34 | collect-heavy expansion, exchange |
| Passive Builder | 14,964 | 1,596 | 2 | 0 | 2 | collect/craft only |
| Snowball Leader | 208,754 | 119,456 | 8 | 8 | 41 | many collects/crafts, expansion, exchange |
| Alliance Push | 66,130 | 25,185 | 8 | 27 | 50 | coordinated collect/craft/spy/attack |
| Low Activity Player | 14,964 | 1,596 | 1 | 0 | 1 | sparse collect/craft |

## Pacing Assertions

Covered by `free-session-balance-anti-snowball.test.ts`:

- First collect must be within 1-3 minutes for a new player.
- First useful craft must be within 5-10 minutes.
- First spy and first attack path must be reachable by 20 minutes.
- Normal player must grow beyond passive play and craft multiple useful items.
- Aggressive player must have higher heat and police pressure than passive play.
- Aggressive player must trigger raids without duplicate pending raid spam.
- Snowball leader must have higher pressure than aggressive play and remain below 85% control.
- Alliance push must remain below both 70% and the current 85% win threshold at 60 minutes.
- Every scenario checks no `NaN`, no unsafe negative resource balances, finite timeline values, and no pending raid count beyond config.

## Config Changes

No balance config values were changed in this sprint.

| Config | Old value | New value | Reason |
| --- | --- | --- | --- |
| n/a | n/a | n/a | Current deterministic scenarios meet MVP pacing and anti-snowball assertions. |

## Win Condition Sanity

Current 85% map control remains acceptable for now. In the 40 district simulation:

- Single aggressive player at 60 minutes: `11/40`, `27.5%`.
- Snowball leader at 60 minutes: `12/40`, `30%`.
- Four-player alliance push at 60 minutes: `26/40`, `65%`.

The alliance case is the closest risk. It proves 85% is not too fast under the scripted 60 minute pressure, but it also suggests a coordinated alliance can approach a dominant position inside an hour. Do not lower the threshold until real sessions show that 85% is unreachable.

Possible later variants if 85% fails live testing:

- A) Keep 85% map control.
- B) 60-70% alliance control with stronger police/heat drag.
- C) Points-based victory after 90 minutes.
- D) Hybrid control plus influence score.

## Building Role Balance

| Building | Role verdict | Notes |
| --- | --- | --- |
| `apartment_block` | Strong | Population/gang-member source, no income/heat, manual collect. |
| `pharmacy` | Strong | Chemicals and stim-pack path; feeds drug lab and boosts. |
| `drug_lab` | Strong | High value/high heat output role exists; not central in current free-session sim path. |
| `factory` | Strong | Metal parts and tech-core/combat-module path; feeds armory. |
| `armory` | Strong | Pistol/SMG/vest/armor path; craft flow tested. |
| `warehouse` | Strong | Storage cap is meaningful; UX clarity is later work. |
| `exchange` | Strong | Dirty -> clean path with heat and audit risk. |
| `casino` | Strong | High reward/high risk laundering; rare map role. |
| `arcade` | Strong | Lower-tier dirty cash/laundering alternative. |
| `smuggling_tunnel` | Strong | Dirty batch and low-visibility risk/reward role. |
| `restaurant` | Good | Clean income and rumor/city-life support. |
| `convenience_store` | Good | Small clean/dirty income and rumor hook. |
| `clinic` | Good | Recovery/support role exists; deeper combat value depends on later live combat testing. |
| `fitness_club` | Good | Income/combat conditioning role exists; item-use clarity can improve later. |
| `power_station` | Strong | Production/storage/support multiplier role. |

## Dashboard Data

No admin UI was built. The simulation and existing projections define the data to expose later:

| Dashboard metric | Source now |
| --- | --- |
| Active players | scenario `playerIds` / session player state |
| Avg owned districts | controlled district counts from `districtsById` |
| Avg heat | `PoliceReadModel.heat` per player |
| Top heat players | sorted `PoliceReadModel.heat` |
| Avg dirty cash | `resourceStatesById[*].balances["dirty-cash"]` |
| Total raids | police core events `police-raid-triggered/resolved` |
| Avg time to first attack | scenario `firstAttackMinute`; later command log |
| Avg time to first raid | scenario `firstRaidMinute`; later police event log |
| Win condition progress | controlled districts / total districts, same as simulation |
| Strongest alliance | alliance-controlled district counts |
| Most contested districts | district ownership/attack event frequency |
| Most used buildings | simulation `mostUsedBuildings`; later building action events |
| Most used actions | simulation `mostUsedActions`; later command/action reports |

## Core Loop Verdict

- First collect: minute `2` in new-player simulation.
- First craft: minute `6`.
- First spy: minute `10`.
- First attack: minute `12`.
- First police warning: minute `23` for normal play, minute `12` for aggressive play, minute `7` for snowball.
- First raid: minute `27` for aggressive play, minute `19` for snowball, minute `35` for alliance push.

Balance verdict: good for MVP. Early game is not too slow, police is not too harsh, and dirty cash has both reward and risk.

Snowball risk: medium. Existing brakes are police pressure, raid thresholds, dirty-cash seizure, heat reduction, pending raid cap, attack duration/cooldown route timing, storage caps, and alliance win threshold. Missing later brake: a clearer global expansion drag if real sessions show per-target attack routing is too easy to chain.

## Tests

Passed during this sprint:

- `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\unit\game-core\free-session-balance-anti-snowball.test.ts`
- `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\unit\game-core\free-session-balance-anti-snowball.test.ts tests\unit\game-core\police-free-session-simulation.test.ts`
- `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\integration\game-core\mvp-buildings-core-loop-hardening.test.ts tests\integration\game-core\stabilization-critical-flow.test.ts`
- `npm run typecheck`
- `npm run smoke:ui`
- `npm run lint:architecture`
- `npm run lint:file-sizes`

One stabilization fixture was corrected from heat `120` to `130` because the current FREE police multiplier (`0.9`) makes `120` aggregate to `108`, below the high raid threshold `115`. The test now actually exercises pending raid creation against the current config.

## Next Recommended Prompt

Run a manual FREE-session playtest pass with browser instrumentation: measure real click friction, visible resource refresh, perceived police feedback, and whether coordinated alliance pressure feels too fast before changing win thresholds.
