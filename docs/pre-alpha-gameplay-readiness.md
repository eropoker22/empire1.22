# Empire Streets pre-alpha gameplay readiness audit

Datum: 2026-07-06
Scope: demo v1 / free mode / demo-ready runtime. Server-authoritative multiplayer wiring is intentionally out of scope.

## 1. Executive summary

Verdict: hra dává smysl jako pre-alpha strategie a demo flow je vhodný pro interní testování, ale ještě ne pro tvrdší veřejný PvP test bez několika P1 rozhodnutí.

Readiness score: 77 / 100.

Nejsilnější části:
- Onboarding už hráče provede vlastním districtem, building action, heat/policií, spy/order flow a LIVE přepnutím.
- Core validace pro mapu, spy, attack, occupy, production a craft má dobré server-authoritative hranice.
- Free-mode cooldowny jsou oddělené od war defaultů a jsou kryté simulation testy.
- Police/heat není jen okamžitý trest: má warning, pending raid, preview consequences, cooldown a decay.

Hlavní brzda:
- Rob/heist jednoduché command handlery jsou designově mělké proti zbytku conflict loopu. `robDistrict` má konstantní loot a heat, nemá vlastní cooldown state a populace je jen precondition, ne závazek/spotřeba. Pro demo onboarding to není blocker, pro server PvP je to P1 before closed alpha.

Demo P1 opravy provedené během auditu:
- Demo onboarding start state nyní drží registraci i recovery na District 1, aby `ensureStartDistrictRecovery()` nepřidal stale lobby district.
- Free-session smoke seeduje District 1, bere skutečnou Restaurant action místo pasivního Autosalonu a dokončí ruční onboarding kroky.
- Stale testy byly upravené na aktuální market ceny a aktuální map-click/onboarding kontrakt.

## 2. Current loop map

| System | Input | Player action | Output | Cooldown/timer | Risk | Feedback | Possible problems |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Start player | Demo onboarding state | Start / refresh `game.html` | District 1 owned, no alliance, 250 population, heat 50, clean/dirty cash | none | stale local/session state | onboarding card, resource bar, district highlight | fixed smoke/runtime mismatch could re-add lobby district |
| District loop | Own district opened | inspect buildings, choose action | building actions, production, defense/trap, adjacent targets | per action | passive chips can look clickable but have no command | district popup, action confirmations, reports | Autosalon first chip is weak first-session affordance |
| Production loop | active pharmacy/factory/drug lab | wait, collect stored output | chemicals/biomass/metal-parts/neon-dust | tick accumulation, building storage cap | warehouse full blocks collect | production panel, collect errors/events | storage cap needs visible reason when full |
| Craft loop | owned craft building + inputs | craft recipe | processing job, later item output | 3-20m free-mode recipes | active processing blocks new craft | processing started/completed events | longer craft recipes are strategic, not onboarding material |
| Building actions | configured building actions | confirm and run | resources, heat, influence, effects, report | 2m to 60m depending action | too many action types for first session | action report + cooldown | some late-game actions are too complex for first 5 minutes |
| Heat/police | heat from actions/passive district heat | keep risk low or accept dirty gains | warning, pending raid, raid effects, heat decay | decay every 150s player / 300s district, raid cooldown 30m | confusing if hidden | wanted panel, raid card, police events | needs continued UI clarity around aggregate pressure |
| Spy/order | adjacent empty/enemy target | spy District 2, later attack/occupy | spy report, attack auth, mission/order cooldown | spy 6m, attack 22m, occupy 12m | waiting if no parallel tasks | report, cooldown markers, button countdown | attack result may feel long if player misses production/building actions |
| Expansion | successful spy + enough pop/influence or successful attack | occupy empty / attack enemy | new district or battle report | occupy 12m, attack 22m | snowball, bad target | report + ownership/progress | occupation is instant in current core after command; UI now treats it as ordered/cooldown in demo |

## 3. Cooldown audit

| Cooldown | Defined in | Purpose | Category | UI feedback | Test coverage | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| Tick rate 5s | `free-mode-timing.ts` / free override | converts ticks to real time | baseline | implicit | free cooldown tests | good |
| Spy 6m | `free-mode.override.ts` `spyCooldownTicks` | prevent route spam, make intel meaningful | strategic | target/button cooldown + reports | conflict, first-loop, smoke | good but long for pure onboarding if alone |
| Spy blocked slot ~40s | `spyDistrict.ts` legacy cooldown | failed/critical spy capacity pressure | first-session | report payload | conflict slot tests | good |
| Attack 22m | `free-mode.override.ts`, `attackDuration.ts` | order/return time and route cooldown | strategic | mission markers/button countdown | first-loop/conflict/smoke | acceptable if player has parallel tasks |
| Occupy 12m | `free-mode.override.ts`, `occupyBalance.ts` | expansion pacing | strategic | occupy target cooldown | occupy tests, first-loop | good; first district cost 50 population controls growth |
| Craft 3-20m | `free-mode-craft-config.ts`, craft handler | item progression | first-session to strategic | processing card/report | craft flow, cooldown tests | good; 20m recipes should stay post-onboarding |
| Production accumulation | `base-production-craft-config.ts`, `completeProduction.ts` | passive resource drip | first-session | storage/collect panels | production tests | good, storage cap must be visible |
| Building action 2-12m production | `free-mode-production-building-actions.ts` | active resource conversion | first-session | action cooldown/report | special action tests | good |
| Building action 10-60m venue/recovery/institutional | free mode action config files | midgame/lategame agency | strategic/long-term | action cooldown/report | registry/projection/smoke | some 60m timers are too long for demo-first content, but gated by building availability |
| Police raid 30m | `free-police-config.ts` | avoid raid spam | strategic | raid card/events | police sim | good for free mode |
| Police decay | `free-police-config.ts`, `heatDecay.ts` | recovery from pressure | strategic | wanted panel/read model | police sim | good |
| Alliance penalties 30m-12h | `base-balance-config.ts` | social churn control | long-term | out of onboarding | alliance tests | future/server only for demo |
| Market refresh/events | market config/rules | economy variability | strategic | market UI | market tests | not onboarding |

Cooldown classification:
- A / first-session: production collect, 2-6m production actions, spy blocked slot, short craft.
- B / strategic: spy 6m, occupy 12m, attack 22m, most 10-30m building actions, raid cooldown.
- C / long-term: 60m power station actions, alliance lockouts, elimination/final lockdown timers.
- D / dangerous: rob/heist have no simple command cooldown in their current handlers; this is dangerous for server PvP, not demo onboarding.

Recommended cooldown changes:
- No immediate number change in this audit.
- Add a future config-backed rob/heist cooldown/commitment rule before closed alpha. Do not patch this in UI only.

## 4. Production/resource audit

| Resource | Source | Sink | First-session role | Midgame role | Risk | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| cash / clean cash | starting resources, restaurant, legal/passive buildings, market actions | craft/building action costs, market, mitigation | lets player click actions | strategic safe economy | too much start cash can hide cost learning | demo 5000 cash is OK for onboarding; live 1500 is tighter |
| dirty-cash | starting resources, restaurant, illegal buildings/actions, rob/heist | laundering, black market, illegal costs | teaches dirty economy | risk/reward engine | if laundering too efficient, heat loses teeth | keep market prices above production cost |
| population | demo 250, apartments/schools | occupy, heist precondition | first expansion budget | expansion limiter | rob only checks pop, does not commit it | keep occupation scaling; decide rob/heist commitment later |
| influence | district/building actions | occupy/political actions | explains expansion cost | strategic gating | hidden if source district influence unclear | show influence cost/reason in target feedback |
| heat/wanted | building actions, conflict, passive district heat | decay, raids/mitigation | teaches police risk | risk pressure | can feel punitive if raid appears without preview | current pending raid preview is good |
| chemicals | pharmacy production/actions, market | stim-pack/drug recipes | simple production material | pharma/drug bottleneck | market exploit if cheaper than production | current market test now tracks config price |
| biomass | pharmacy production/actions, market | drug/stim/stash | early recipe material | drug economy | storage cap frustration | keep cap messages visible |
| metal-parts | factory/port/market | tech-core, weapons, modules | craft gateway | combat/defense loop | early scarcity can block attack prep | starting 8 is enough for first craft |
| tech-core | factory craft/market | advanced modules/defense | advanced preview only | bottleneck | high value, should not be cheap | current market price elevated |
| combat-module | factory/armory actions | advanced equipment | not first-session critical | combat scaling | naming/action overlap with armory can confuse | clarify later, no scope change now |
| drugs/boosts | drug lab/craft/market | boosts/sales | optional | dirty economy | black market arbitrage | monitor sell/buy spread |
| weapons/defense | armory/market | attack/defense/traps | attack validation | PvP power | paid/resource purchase risk later | never monetize direct PvP advantage |
| warehouse capacity | warehouse network | collect cap | can show limits | anti-hoarding | fake success if full | core returns `production_storage_full`; UI must display it |

Validation checks:
- `production_empty`, `production_not_owned`, `production_not_supported`, `production_storage_full`, `craft_missing_inputs`, and `craft_processing_active` are explicit errors.
- Resource mutation paths use `Math.max(0, ...)` for spends and caps accepted collection, reducing negative-resource risk.
- Warehouse full collect returns error and no event; no fake success found.

## 5. Building actions audit

Configured free-mode building action inventory inspected:
- Production: `produce_chemicals`, `produce_biomass`, `produce_stim_pack`, `produce_neon_dust`, `produce_pulse_shot`, `produce_velvet_smoke`, `produce_tech_core`, `produce_combat_module`, `armory_craft_weapons`.
- Restaurant: `restaurant_collect_revenue`, `restaurant_cover_meetings`, `restaurant_local_network`.
- Venue/economy: `back_cashdesk`, `good_rate`, `quiet_backroom`, `vip_night`, `bribed_inspector`, `strip_club_collect_cash`, `vip_lounge`, `bar_whispers`, `private_party`.
- Recovery/support: `open_channel`, `extract_losses`, `stabilization_protocol`, `collect_population`, `collect_students`, `evening_course`, `night_machines`, `backup_grid_switch`, `power_station_feed_production`, `power_station_reduce_heat`, `start_drug_sale`, `street_dealers_collect_hot_cash`, `street_dealers_move_stash`.
- Institutional/market/political: `official_cover`, `city_contract`, `emergency_decree`, `express_import`, `black_charter`, `evacuation_corridor`, `port_container_cut`, `parliament_policy_window`, `speculative_buy`, `market_pressure`, `insider_window`, `liquidity_injection`, `frozen_accounts`, `currency_intervention`, `backroom_pressure`, `quiet_negotiation`, `media_screen`.

| Category | Examples | Why it exists | Feedback | Risk | Verdict |
| --- | --- | --- | --- | --- | --- |
| Money actions | restaurant revenue, back cashdesk, good rate, quiet backroom | immediate cash/dirty-cash agency | report + cooldown | laundering balance | good demo anchor |
| Heat/risk actions | VIP night, market pressure, black charter | choose profit vs police | heat + effect report | too complex early | keep out of onboarding |
| Recovery/salvage | clinic, recycling, smuggling | recover losses and sustain aggression | report + resource changes | no value until losses exist | midgame only |
| Population/influence | collect population/students, local network, evening course | expansion budget | report/action state | zero-cooldown collect spam if UI allows empty clicks | core-specific handlers gate useful value |
| Spy/intel support | cameras/alarm effects, recruitment center support indirectly | conflict preparation | spy report | hidden math | okay for alpha |
| Market/economy | stock, central bank, airport | lategame market play | report/effect | too much scope for onboarding | do not onboard yet |
| Special payload | street dealers, airport, stock | parameterized economy | custom confirmation | UI can fake clarity if payload invalid | server validation needed before public PvP |

Best demo actions:
- `restaurant_collect_revenue`: immediate visible money, tiny heat, 30m cooldown.
- `produce_chemicals` / `produce_biomass`: short production action, clear material reward.

Weakest first-session action:
- Passive building chips like Autosalon can be selected before an actionable building. Smoke now picks Restaurant to avoid testing a false first action.

Test coverage:
- `smoke:free-session` now walks a stable Restaurant action through open/confirm/feedback/onboarding completion.
- Existing registry/projection tests cover action metadata and cooldown rendering.

## 6. Spy/attack/order audit

| Check | Current behavior | Verdict |
| --- | --- | --- |
| Spy preconditions | target must be adjacent empty/enemy, not self/ally, owned origin required, locked/destroyed blocked | good |
| Spy result | server-authored notification report with result, trap info, occupy unlock, attack auth TTL | good |
| Spy duration/cooldown | route cooldown 6m in free mode; failed spies can block slots ~40s | good |
| Attack preconditions | enemy-only, adjacent owned origin, successful spy authorization, positive attack power, cooldown | good |
| Attack duration/cooldown | 22m free mode, guardrails, faction/day-night/garage modifiers | strategic but clear if cooldown visible |
| Source/target validation | version conflict, adjacency, origin ownership | good |
| Self/ally/enemy | self/ally blocked, former ally truce blocked | good |
| Destroyed/locked/contested | locked/destroyed blocked, attack can create contested/destroyed/captured | good |
| Trap interaction | active trap can block and trigger losses/report | good |
| Feedback | reports, city feed, last command status, map markers | good |

Minimum matrix status:
- valid spy: covered.
- spy invalid target: covered.
- attack without spy: core returns `SPY_REQUIRED`.
- valid attack/order started: covered.
- attack invalid target/self/owned blocked: covered by map action validation and tests.
- visible feedback exists: reports and smoke cover.
- cooldown/return time exists: conflict/free cooldown tests and smoke cover.

Main design issue:
- The player understands "spy first" during onboarding, but a 22m attack result requires parallel activities. The UI must keep showing "order started" and countdown; otherwise it becomes waiting without cause.

## 7. Heat/police audit

Heat sources:
- Building actions with `heatGain`.
- Attack/occupy and some dirty economy actions.
- Passive district heat from fixed buildings.
- Market/airport/stock/casino special risks.

Heat sinks/control:
- Player heat decay by wanted level every 30 ticks in free mode.
- District heat decay every 60 ticks.
- Police raid consequences reduce heat.
- City Hall / Central Bank / Casino mitigation actions exist for later phases.

Police lifecycle:
- Aggregate pressure = player heat pressure + weighted owned district heat.
- Medium pressure creates warning.
- High/extreme pressure creates pending raid, preview consequences, one pending raid per player, concurrent raid limits by day/night.
- Pending raid can be acknowledged/resolved/expired. Free mode auto-resolves expired pending raids.

Verdict:
- Heat is an interesting risk, not just punishment. It is tied to dirty cash, aggressive expansion, district heat and raid preview.
- Demo heat is fair: onboarding starts at heat 50 to teach the concept without immediate destruction, while free police high threshold is 115 and extreme is 180.
- The main UX requirement is to keep the raid card/resource bar visible whenever police consequence windows are open.

## 8. First 30 minutes simulation summary

Existing simulation surfaces used:
- `free-session-balance-anti-snowball.test.ts`: new-player, normal, aggressive, passive, snowball, alliance, low-activity.
- `police-free-session-simulation.test.ts`: quiet builder, normal, aggressive, dirty-money stacker, hot district owner, snowball leader.
- `free-mode-shared-city-simulation.test.ts`: shared-city catalog includes `solo-player-first-30-minutes`.

| Scenario | Expected player state | Frustration risk | Exploit risk | Decision density |
| --- | --- | --- | --- | --- |
| Casual | owns District 1, collects/uses Restaurant, sees heat and spy/order start, likely no expansion before 30m unless guided | low-medium if attack result is still pending | low | medium: building action + police + spy/order |
| Active | collects production, crafts, spies early, starts attack/occupy as soon as allowed | medium from 22m attack wait | medium if rob/heist are discovered | high if production/buildings are visible |
| Risky | stacks dirty/risky actions, heat rises, warning/raid pressure appears | low if warnings visible, high if ignored | medium | high: profit vs police |
| Confused | clicks wrong district, tries attack without spy, skips onboarding | medium | low | low-medium; core errors are safe, UI must explain reasons |

5-minute read:
- Player should understand "my district", "building gives resource", "heat matters", and "spy starts a mission".

15-minute read:
- Player should have seen at least one production/craft or police feedback event and have a spy/occupy/attack path visible.

30-minute read:
- Player should understand why expansion matters: more districts mean more buildings, production, score and survival in Očista/final lockdown.

## 9. Exploit/edge-case risks

Fixed during audit:
- Demo onboarding could be polluted by stale registration `startDistrictId` and re-add a non-District-1 district. Runtime now aligns the stored preview registration with onboarding District 1.
- Free-session smoke could choose a passive building chip and fail the "stable building action" audit. Smoke now chooses Restaurant.
- Stale tests expected old market price and old map-click source text.

Found, not fixed:
- P1 future server/PvP: rob/heist simple handlers lack route cooldown state; rob only checks population and awards constant loot. Needs config-backed rule before competitive server play.
- P2 demo clarity: passive building chips need clearer non-action affordance in first-session.
- P2 design clarity: `armory_craft_weapons` outputs `combat-module`, which can read like weapons but produces a module.
- P2 pacing: 22m attack is strategically coherent, but the first demo must keep parallel tasks obvious.

No evidence found:
- Negative resource mutation in audited collect/craft/building spends.
- Production full fake success.
- Attack without spy bypass.
- Downtown occupation before final lockdown.

## 10. Monetization verdict

Verdict:
- Free mode is a good funnel if it stays readable, time-boxed and fair.
- War/Premium mode has value as a longer, harder, competitive server/season, not as direct power.

Safe monetization:
- Cosmetic gang profiles, avatar/crest/banner customization.
- Premium visual themes.
- Founder/supporter badges without gameplay advantage.
- Seasonal cosmetic battle pass.
- Private season/server access.
- Expanded statistics/history.
- War mode entry or hosted premium seasons.

Dangerous monetization:
- Direct resources, weapons, defense, cooldown speedups, police immunity, paid attack/spy advantage.
- Lootboxes with gameplay advantage.
- Any paid modifier that changes Empire score in competitive mode.

Metrics needed before pricing:
- First 5m onboarding completion.
- First meaningful action time.
- 30m retention / idle time.
- Heat warning comprehension.
- Expansion attempt rate.
- Attack/spy conversion rate.
- Rage-close after police/failed attack.
- Economy inflation per 30/60/120 minutes.

Recommended Free -> War funnel:
- Free teaches loops and short competitive stakes.
- War sells stronger schedule, prestige, season identity and fair competition, not advantages.

## 11. Readiness score

| Category | Score | Notes |
| --- | ---: | --- |
| Core gameplay logic | 16 / 20 | strong map/spy/attack/production validation; rob/heist simpler |
| First-session clarity | 12 / 15 | onboarding clear after District 1 smoke fix; passive chip risk remains |
| Cooldown pacing | 11 / 15 | coherent free mode; attack is long for first session but strategic |
| Economy/resource balance | 11 / 15 | production/market better aligned; rob/heist/simple dirty flows need PvP hardening |
| Production/craft loop | 8 / 10 | good validation and clear outputs |
| Combat/spy/order loop | 7 / 10 | server logic strong; async wait needs constant UI feedback |
| Police/heat loop | 4 / 5 | good warning/raid/decay model |
| Test confidence | 5 / 5 | typecheck/unit/smoke/e2e/simulation coverage exists |
| Monetization readiness | 3 / 5 | strategy clear, not implemented |
| Total | 77 / 100 | good pre-alpha base with P1 PvP/economy hardening |

Interpretation: 70-84 means good foundation, fix P1 before broader testers.

## 12. Prioritized fixes

P0:
- None currently found for demo-ready gameplay after smoke/onboarding state fix.

P1 before 5-10 external testers:
- Decide and implement config-backed rob/heist cooldown/commitment/heat pressure rule in core, with tests.
- Ensure first-session UI never presents passive buildings as if they are required actions.
- Verify mobile/desktop action confirmations always show top resources and clear missing-resource reason.

P2:
- Improve naming/description for `armory_craft_weapons` vs `combat-module`.
- Add compact "why expand" reminder in live UI outside onboarding if analytics show confusion.
- Add report copy for long attack return time so 22m feels intentional.

## 13. What not to change before testing

- Do not add new onboarding scope for market, bounty or alliance.
- Do not add new currencies or buildings.
- Do not connect reserve/join/load/submit server session flow as part of demo polish.
- Do not monetize resources, cooldown speed or PvP power.
- Do not reduce every cooldown globally; tune only with simulation evidence.
- Do not move gameplay decisions into `page-assets/js/app/runtime.js`.

## 14. Future server-only blockers

- Production must fail closed without production-ready identity/session repositories.
- Gameplay `load` and `submit` must derive player authority from validated gameplay sessions.
- Snapshot tokens must not authorize gameplay.
- Command reservation/idempotency and replay protection must be active in production.
- Rob/heist spam prevention must be authoritative, not UI-only.
- Market/bounty/alliance need server-authoritative settlement before competitive mode.
- Strict `smoke:gameplay-slice:server` can remain non-demo-blocking until server session wiring is intentionally enabled.

## P1 hardening follow-up

### Rob/heist decision

Rob and simple heist remain instant core commands for this demo slice; they were not converted into a new async order system. The P1 spam risk is handled by a minimal config-backed authoritative cooldown:

| Command | Decision | Free-mode value | Commitment surface | Player feedback |
| --- | --- | ---: | --- | --- |
| `rob-district` | target + source-route cooldown in core/config | 10 minutes | `rob:{targetDistrictId}` and `rob-source:{sourceDistrictId}` | disabled reason + cooldown ticks in district projection and command hints |
| `heist-district` | target + source-route cooldown in core/config | 8 minutes | `heist:{targetDistrictId}` and `heist-source:{sourceDistrictId}` | disabled reason + cooldown ticks in district projection and command hints |

This blocks repeated same-target farming and same-source route spam without adding resources, new orders, localStorage locks or UI-only rules. Population is still a precondition for rob and gang members remain part of heist validation; deeper PvP commitment and idempotency still belong to the future server sprint.

### Disabled action reason policy

The policy for the tester build is: every critical disabled button must show the server/read-model reason, not a client guess. Building actions, collect/craft, spy, attack, occupy, rob, heist, defense and trap actions should expose one of:

- missing resource or population
- storage full or production empty
- cooldown/action already running
- invalid target, own/ally target blocked, not adjacent or spy required
- district locked/destroyed/contested
- police/heat pressure where applicable

Rob/heist now reuse core validators in the district projection and expose `disabledCode`, `disabledReason` and `cooldownRemainingTicks`. Command hints also include cooldown and disabled reason summaries for the server-fed client.

### Active order feedback policy

Long async conflict actions must remain visible after the popup closes. Attack target projection now carries `cooldownRemainingTicks`, command hints include active `attack-district` cooldowns, and the district panel renders a compact `čekání X ticks` label on the affected route. The legacy street/news cooldown feed can list running cooldowns as passive, non-dismissible status messages.

The rule is intentionally read-model/UI-only feedback; attack timing still comes from the core attack handler and conflict config.

### Passive building chip policy

Fixed district buildings now classify chips as:

- `Spustit akci` for active player-triggered actions.
- `Výroba` for production/craft buildings.
- `Pasivní bonus` for passive infrastructure.

Onboarding and smoke flows should keep choosing a stable active action instead of passive chips, so testers do not read passive infrastructure as a required first click.

### Armory/combat-module copy decision

The resource key remains `combat-module`. Player-facing Czech copy now treats it as a component:

| Old copy | New copy | Reason |
| --- | --- | --- |
| `Combat Module` | `Bojový modul` | module/component, not a finished weapon |
| `Craft Weapons` style armory copy | `Vyrobit výzbrojní modul` | avoids promising a weapon when output is a module |

Config labels, production/craft labels, player summaries, reports and legacy runtime copy should use the new label consistently.

### Monetization guardrail check

No monetization was implemented. Safe monetization remains cosmetics, avatars, banners, founder/supporter identity, private seasons and expanded statistics. Dangerous monetization remains direct resources, cooldown speedups, paid spy/attack advantage, police immunity or any PvP power advantage.

### Remaining before 5-10 player test

- Run one manual desktop and phone pass through onboarding, rob/heist disabled states, attack start and production/craft copy.
- Confirm active order/cooldown feedback is visible in the live map experience after popup close and after refresh.
- Keep strict server smoke non-blocking until session authority is intentionally wired.
- Do not add bounty, market or alliance onboarding before the first 5-10 tester pass.
