# Free Battle Royale Balance Audit

Date: 2026-05-27

Scope: original audit only. Later cooldown tuning changed Free BR action pacing; this report now reflects those cooldown labels where mentioned, but still does not prescribe automatic config changes.

Current endgame note: this historical audit predated Final Lockdown becoming the primary FREE-mode win path. The old 75% district-control victory is now disabled for FREE mode; district control remains important for score and strategy, but match resolution is through Final Lockdown / Final Empire Score.

## Summary verdict

Current Free BR pacing is strong as an onboarding shell: players can act immediately, the first hour is not empty, the elimination schedule creates readable pressure, quiet hours prevent overnight losses, and top 8 stopping works.

Historical endgame risk: with 161 active districts and eliminations stopping at top 8, the old 75% control victory was not reached in these simulations before the 7 day hard timeout. That finding was the reason FREE mode moved to Final Lockdown as the deciding mechanism.

Second risk: action pacing is uneven. Shared-city simulation shows very early attacks and expansion, but also many dead turns and extreme heat spikes for aggressive profiles. This points at cooldown/action availability and police pressure as the next tuning area, not elimination timing.

## Commands run

| Command | Result |
| --- | --- |
| `npm run simulate:free-mode-pacing-report` | PASS, report generated |
| `npm run simulate:free-mode-pacing-report:json` | PASS, JSON generated |
| `npm run simulate:free-mode-pacing-report:matrix` | First run timed out at 180s; second run passed with 420s timeout |
| `npm run balance:free-mode` | PASS |
| `npm run simulate:free-mode -- --variant=elimination-8h-stop8-lower-catastrophe --districts=161 --bots=20 --maxHours=96 --hours=8,12,16,20,24,48,72,96 --tickStride=2880` | PASS |
| `npm run simulate:free-mode -- --variant=elimination-8h-stop8-lower-catastrophe --districts=161 --bots=20 --maxHours=168 --hours=24,72,96,120,144,168 --tickStride=5760` | PASS |

Notes:

- Two finer 161-district long runs timed out: 168h at `tickStride=720` after 240s, and 96h at `tickStride=720` after 360s.
- No E2E tests were run. This audit is simulation/config/rules analysis, not browser flow validation.

## Current rules snapshot

| Area | Current value |
| --- | --- |
| Players | 20 |
| Districts | 161 |
| Downtown districts | 8 |
| First elimination | 8h, tick 5,760 |
| Elimination interval | 4h, 2,880 ticks |
| Danger zone | 3 players |
| Quiet hours | 00:00-06:00 Europe/Bratislava |
| Elimination stop | Top 8 |
| Victory threshold | Disabled in current FREE mode; historical audit used 75% active districts |
| Minimum victory age | Not used by current FREE endgame; historical audit used 72h, tick 51,840 |
| Control hold | Not used by current FREE endgame; historical audit used 6h, 4,320 ticks |
| Hard timeout | 7 days, tick 120,960 |

Important current-code note: the working tree now uses score-first elimination comparison. Controlled districts are still heavily weighted through `scoreWeights.controlledDistricts`, but they are no longer the primary comparator before total score.

## Scenario table

| Scenario | Window | Players | Key result | Warnings |
| --- | ---: | ---: | --- | --- |
| shared-city-20p | 60m | 20 | 313 accepted actions, first action/attack at 1m, first expansion at 6m, 23/161 districts owned at 60m | dead turns, high heat, resource bottlenecks |
| solo-player-first-30-minutes | 30m | 1 | 30 accepted actions, mostly economy collection | low conflict, no attacks, bottlenecks |
| shared-city-5p | 60m | 5 | 184 accepted actions, max heat 72 | dead turns, heat spike |
| aggressive-conflict-player | 45m | 8 | 207 accepted actions, 186 attacks, max heat 206 | heat spike, dead turns |
| passive-economy-player | 45m | 5 | 146 accepted actions, 132 collections, max heat 0 | dead turns, low conflict |
| 161-district BR, 96h, 4h stride | 96h | 20 | Top 8 reached by 68h; 75% never reached | city control too fragmented |
| 161-district BR, 168h, 8h stride | 168h | 20 | Hard timeout fired at 168h with no winner | 75% unreachable in this run |

## 8h first elimination

The first elimination is fair for casual onboarding. The first hour is not empty:

- first meaningful action: 1m
- first accepted attack: 1m
- first production collection: 2m
- first expansion: 6m
- after 60m: 206 accepted attacks, 71 production collections, 33 spy actions

At the first 8h checkpoint in the 161-district pacing run:

- first elimination had just occurred
- 19 players remained
- 33 successful attacks had happened
- top player held 3 districts
- top alliance held 10/160 active districts, 6.25%

Verdict: 8h is not too short for active players and is generous for casual players. It may be slightly slow for highly active players, but the first-hour action density suggests the server is not dead before the first cut.

## 4h elimination interval

A 4h interval is appropriate for an async browser strategy game. After the cooldown tuning pass, baseline Free BR attack cooldown and minimum attack duration are both 264 ticks, roughly 22 minutes at 5s/tick, before applicable reductions.

Observed 161-district 96h timeline with 4h stride:

| Elimination | Hour | Active after |
| ---: | ---: | ---: |
| 1 | 8 | 19 |
| 2 | 12 | 18 |
| 3 | 16 | 17 |
| 4 | 20 | 16 |
| 5 | 32 | 15 |
| 6 | 36 | 14 |
| 7 | 40 | 13 |
| 8 | 44 | 12 |
| 9 | 56 | 11 |
| 10 | 60 | 10 |
| 11 | 64 | 9 |
| 12 | 68 | 8 |

The quiet-hour gaps create natural relief. Danger-zone comeback is plausible because 4h contains many possible attacks/collections, but the report cannot prove comeback quality per player yet. Add a dedicated danger-zone escape metric for this.

## Top 8 stop

Top 8 stop works. The lifecycle stops eliminations when active players are at or below `minActivePlayers = 8`, and the long 161-district simulation stayed at 8 active players after reaching top 8.

Risk: top 8 can become a dead phase. In the 96h run, after top 8:

- top player controlled only 19/157 districts at 96h, 12.1%
- top alliance controlled only 31/157, 19.75%
- 75% was not reached

The endgame goal is clear on paper, but not realistically reached in the current bot simulations.

## Disabled 75% Victory Historical Audit

Required district control is:

| Active districts | Required at 75% |
| ---: | ---: |
| 161 | 121 |
| 160 | 120 |
| 159 | 120 |
| 158 | 119 |
| 157 | 118 |
| 156 | 117 |

Neutralized districts still count as active districts. Destroyed districts lower the threshold; neutralized districts do not.

Simulation result:

- 96h run: first25/first50/first75 never reached.
- 168h run: first25/first50/first75 never reached.
- 168h hard timeout resolved the match with `winnerType = none`.

Verdict: this historical route is no longer an active FREE-mode win condition. The useful finding is that district control stayed fragmented enough that 75% control was a poor primary endgame, while the controlled district count remains a strong Final Empire Score input.

## District dominance and elimination score

The current working tree is no longer district-count-first. Elimination now sorts by total score first, then controlled districts, then last activity, then player id. That fixes the hard bug where cheap district count automatically beat a smaller but richer empire.

However, district count is still a very strong score component:

- 1 controlled district = 10,000 score
- equivalent to 400 district influence
- equivalent to 20 active buildings
- equivalent to 100,000 clean cash
- equivalent to 50,000 resource value
- equivalent to 5,000 population

This is probably acceptable for BR clarity, but it still strongly rewards expansion. The current risk is not that the comparator ignores economy; the risk is that the score weight may still make broad expansion the safest strategy once players understand the system.

Archetype read from matrix:

- aggressor: very high action rate and high heat; 186 attacks in 45m for the aggressive scenario.
- economy builder: stable income, low heat, very few attacks.
- scout/balanced profiles: many dead turns in shared-city matrix.
- passive economy: safe but probably not on a winning path.
- high-heat aggressor: can expand fast but creates severe police/heat pressure.

## Rare and downtown snowball

Downtown buildings are powerful enough to matter:

| Building | Count | Income / pressure |
| --- | ---: | --- |
| Stock Exchange | 1 | 13,200 clean/h, 0.45 influence/min, 0.18 heat/min |
| Central Bank | 2 | 9,600 clean/h each, reserve/interest mechanics, 0.1 heat/min |
| Airport | 1 | 10,800 clean/h + 2,700 dirty/h, logistics bonuses, 0.2 heat/min |
| City Hall | 1 | 7,800 clean/h, 0.85 influence/min, heat management/control tools |
| Court | 2 | 6,300 clean/h each, raid mitigation |
| VIP Lounge | 3 | 6,300 clean/h + 1,800 dirty/h, strong intel/influence |
| Port | 1 | 1,560 clean/h + 510 dirty/h, low passive heat |

The current simulations do not expose a dedicated "early downtown owner survives to top 8" metric, so this report cannot honestly claim a measured survival rate for 1 or 2 early downtown districts. Source audit says early downtown ownership is a serious snowball vector, especially Stock Exchange, Central Bank, Airport, City Hall, and Court.

Police/heat does apply pressure: shared-city-20p hit average heat 42.2 and max heat 316 in the first hour, and the matrix raised heat-spike warnings. That pressure may be too spiky for aggressors while still not directly proving that rare-building owners are catchable.

Recommended next test: add a simulation scenario that force-assigns 0/1/2 downtown districts at start and reports top8 survival, cash delta, heat delta, attacks received, and 75% progress.

## Quiet hours

Quiet hours behave correctly by design and existing lifecycle tests cover the critical cases:

- no elimination during 00:00-06:00 Europe/Bratislava
- a deferred elimination resumes at the quiet-hour end
- deferred eliminations do not stack into multiple cuts at 06:00
- read model exposes `deferredFromTick` and `quietHoursResumeTick`

Expected schedule to top 8 by local server start time:

| Local start | First elimination | Top 8 elapsed | Deferred cuts before top 8 | Eliminations in first 24h |
| --- | --- | ---: | ---: | ---: |
| 08:00 | 16:00 | 62h | 2 | 3 |
| 12:00 | 20:00 | 66h | 3 | 3 |
| 18:00 | next day 06:00 | 64h | 3 | 4 |
| 22:00 | next day 06:00 | 60h | 2 | 5 |
| 23:30 | next day 07:30 | 58.5h | 2 | 5 |

Without quiet hours, top 8 would happen after 52h: first cut at 8h plus 11 intervals. With quiet hours, realistic top 8 timing is about 58.5-66h depending on start time.

## What works

- First hour has real actions immediately.
- First expansion at 6m is good for onboarding.
- 8h first elimination is casual-friendly and not punishing.
- 4h interval creates pressure without requiring constant presence.
- Quiet hours protect sleeping players.
- Top 8 stop is correctly enforced.
- Score-first elimination now better reflects whole empire strength.
- Balance gate passes hard checks.

## Risky

- Many dead turns in shared-city matrix indicate cooldown/action availability friction.
- High heat spikes may punish aggressors sharply and create confusing police pressure.
- Economy grows very fast in long simulations while control remains fragmented.
- Downtown/rare buildings look powerful enough to need targeted snowball tests.
- Danger-zone comeback is plausible but not directly measured.

## Probably broken

- Historical 75% victory is not realistically reached in current simulations and is now disabled for FREE mode.
- Without Final Lockdown, the 7 day hard timeout can end with no winner.
- Top 8 endgame needed a score-based resolver; current FREE mode uses Final Lockdown.
- Current simulation reports do not expose enough per-archetype survival metrics for downtown owners and danger-zone players.

## Recommendations, no automatic config changes

Do not change elimination timing first. The 8h/4h/top8 structure is basically sound.

Recommended next tuning targets:

1. Add metrics before changing values:
   - danger-zone escape rate
   - early downtown owner top8 survival rate
   - attacks received by top economy/downtown owner
   - top8 time-to-victory after eliminations stop
   - per-profile dead-turn rate

2. Investigate Final Lockdown quality before touching early pacing:
   - verify Final Empire Score rewards district control, downtown, buildings and resources without reviving instant map-control victory
   - keep neutralized defeated district behavior separate from the endgame resolver
   - use simulation matrix runs to tune only if Final Lockdown produces weak or confusing winners

3. Investigate cooldown/action availability:
   - attack/occupy/action loops produce many dead turns for non-aggressor profiles
   - cooldown changes should be tested against heat spikes and expansion speed

4. Add downtown snowball scenarios:
   - early 1 downtown owner
   - early 2 downtown owner
   - Central Bank, Stock Exchange, Airport, City Hall, Court, VIP Lounge, Port owner variants

Suggested values to test later, not apply now:

- Final Empire Score weight candidates only if future matrix runs show weak winner quality
- top8-only control thresholds are not a current FREE-mode path
- do not revive the historical 75% instant victory without a new design review
- cooldown candidates should be tested separately, because attack readiness is already very early

## Next tests to add

- `free-mode-downtown-snowball-sim.test.ts`: force early downtown ownership and report survival/cash/heat/control.
- `free-mode-danger-zone-comeback.test.ts`: put a player in rank 1-3 danger zone and simulate 4h recovery windows.
- `free-mode-top8-endgame.test.ts`: start from top8 snapshot and test whether a winner appears before 168h.
- `free-mode-victory-threshold-matrix.test.ts`: compare 75/70/65/60 without changing production config.
- `free-mode-cooldown-matrix.test.ts`: compare attack/occupy cooldown sets while monitoring heat and dead turns.
