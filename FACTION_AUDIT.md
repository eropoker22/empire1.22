# Faction Audit

Audit date: 2026-07-04

## Scope

Audit covers faction selection, faction preview copy, gameplay slice persistence, faction read model, passive modifiers, faction action modal, legacy static bridge, tests and debug audit helpers.

Primary files:

- `packages/game-config/src/public/faction-definitions.ts`
- `packages/game-config/src/legacy-page/faction-config.js`
- `packages/game-core/src/rules/factions/factionRules.ts`
- `packages/game-core/src/projections/faction-read-model-projection.ts`
- `page-assets/js/faction.js`
- `page-assets/js/app/faction-actions-runtime.js`
- `pages/faction.html`
- `pages/game.html`
- `tools/debug/src/free-mode-pacing/factionPassiveAudit.ts`
- `tests/unit/game-core/faction-foundation.test.ts`
- `tests/unit/faction-legacy-bridge.test.js`
- `tests/unit/faction-actions-runtime.test.js`
- `tests/integration/faction-slice-bootstrap.test.ts`

## Verdict

Factions are almost ready for alpha as a passive identity/playstyle layer.

They are not ready to be presented as a full active faction ability system. Passive effects are mostly real and server-backed. Special faction actions are preview-only and disabled. Several modifier contracts exist for future systems and must stay visibly planned until they are wired.

## Source Of Truth

Canonical faction balance lives in `packages/game-config/src/public/faction-definitions.ts`.

Legacy static UI reads `packages/game-config/src/legacy-page/faction-config.js`, which is a compatibility bridge synchronized by unit tests against the public definitions.

Runtime rules live in `packages/game-core/src/rules/factions/factionRules.ts` and are applied by economy, production, conflict, spy, heist, rumor and population systems.

## Server And Storage Behavior

- Faction id is persisted on the server gameplay slice player.
- Invalid or legacy faction ids are normalized server-side.
- Rejoining an existing player does not change the locked faction.
- Session token payload includes the normalized faction id.
- Local preview/session data can show the selected faction in legacy UI, but gameplay authority comes from the server slice.
- Faction starting packages are intentionally absent. `applyFactionStartingPackage` is a no-op compatibility shim.

## Active Modifier Coverage

These modifiers have real call-sites:

- `cleanIncomeMultiplier`: district and fixed building cash income.
- `dirtyIncomeMultiplier`: district and fixed building dirty-cash income.
- `productionMultiplier`: generic production buildings.
- `illegalProductionMultiplier`: production from `drug_lab`, `smuggling_tunnel`, `street_dealers` when they use production building output.
- `smugglingIncomeMultiplier`: passive Smuggling Tunnel dirty income.
- `techProductionMultiplier`: production for `tech-core`, `data`, `intel`.
- `heatGainMultiplier`: attack/heist heat, building action heat and fixed building passive heat. It does not currently affect occupy heat.
- `illegalActionHeatGainMultiplier`: illegal building action heat.
- `influenceGainMultiplier`: positive influence gains.
- `spySuccessChanceBonus`: spy success chance.
- `trapDetectionChanceBonus`: spy trap reveal chance.
- `attackPowerMultiplier`: district attack power.
- `defensePowerMultiplier`: district defense power.
- `baseDefensePowerMultiplier`: non-camera/non-alarm base defense items.
- `cameraEffectivenessMultiplier`: camera defense and anti-spy strength.
- `alarmEffectivenessMultiplier`: alarm defense and anti-spy strength.
- `attackDurationMultiplier`: attack duration/cooldown.
- `robberyCooldownMultiplier`: district heist cooldown.
- `attackCooldownMultiplier`: attack cooldown.
- `occupyCooldownMultiplier`: occupy cooldown.
- `robberyDirtyCashLootMultiplier`: dirty-cash part of heist loot.
- `robberyLootMultiplier`: generic heist loot.
- `aggressiveActionHeatGainMultiplier`: attack, occupy and heist heat.
- `defenseSystemEffectivenessMultiplier`: shared defense system multiplier for cameras and alarms.
- `populationGenerationMultiplier`: Apartment Block and School population/student generation.
- `equipmentLossMultiplier`: attacker equipment losses in district attacks.
- `rumorTruthMultiplier`: truth chance for eligible rumor events.

## Planned Or Not Yet Applied

These are defined but not currently applied by gameplay systems:

- `spyInfoQualityMultiplier`: no separate spy report quality layer exists yet.
- `secretActionHeatGainMultiplier`: no unified secret-action heat context exists yet.
- `occupyPowerMultiplier`: occupy is currently a claim flow after spy intel, not a power contest.
- `rumorGenerationMultiplier`: rumor generation has no central faction-aware helper.
- `marketFeeMultiplier`: market fees do not currently consume this modifier.
- `upkeepCostMultiplier`: no upkeep/combat-cost system applies this yet.

All faction `specialAction` entries are `preview` and disabled in the game modal.

## Faction Promise Matrix

### Mafián

Promises:

- Clean income +10 %
- -4 % heat z útoků, heistů, akcí budov a pasivního tlaku
- Spy -3 p. b.
- Special action: Tichá dohoda

Status:

- Clean income is active.
- Heat reduction is active for attack/heist heat, building action heat and fixed building passive heat, but not occupy heat.
- Spy penalty is active.
- Tichá dohoda is preview-only and disabled.

Risk:

- Heat copy now avoids a global claim because occupy heat is not covered by `heatGainMultiplier`.

### Kartel

Promises:

- Dirty income +18 %
- Illegal production +15 %
- Smuggling +10 %
- Illegal action heat +15 %
- Clean income -8 %
- Defense power -5 %
- Special action: Noční zásilka

Status:

- Dirty income, clean penalty and defense penalty are active.
- Illegal production is active for configured illegal production buildings.
- Smuggling bonus is active for Smuggling Tunnel passive income.
- Illegal action heat is active for illegal building actions.
- Noční zásilka is preview-only and disabled.

Risk:

- Illegal production only matters where the building actually uses the production pipeline.

### Kult

Promises:

- Influence gain +20 %
- Population generation +10 %
- Defense power +10 %
- Clean income -10 %
- Attack power -5 %
- Rumor/suspicion pressure
- Market fee +10 %
- Special action: Masová posedlost

Status:

- Influence, population, defense, clean penalty and attack penalty are active.
- Rumor generation is planned.
- Market fee is planned and was moved out of the active legacy disadvantage list.
- Masová posedlost is preview-only and disabled.

Risk:

- Description says Kult can flood the city with unrest. That is not fully true until `rumorGenerationMultiplier` is wired.

### Tajná Organizace

Promises:

- Spy success +15 p. b.
- Trap detection +15 p. b.
- Better intel/rumors
- Secret action heat -8 %
- Attack power -10 %
- Clean income -8 %
- Dirty income -8 %
- Special action: Spící buňka

Status:

- Spy success and trap reveal are active.
- Rumor truth +10 % is active for eligible rumor events.
- Attack and income penalties are active.
- Spy info quality is planned.
- Secret action heat is planned.
- Spící buňka is preview-only and disabled.

Risk:

- "Přesnější informace" is only partially backed: success/truth improve, but report richness/quality does not.

### Hackeři

Promises:

- Rumor truth +50 %
- Camera effectiveness +15 %
- Alarm effectiveness +15 %
- Tech production +10 %
- Spy success +10 p. b.
- Attack power -8 %
- Dirty income -8 %
- Base defense -5 %
- Special action: Výpadek systému

Status:

- All listed passive modifiers are active.
- Rumor truth applies only to rumor events that carry `truthChancePct`.
- Výpadek systému is preview-only and disabled.

Risk:

- The faction is honest as a passive package, but the active digital sabotage fantasy is still preview-only.

### Motorkářský Gang

Promises:

- Robbery cooldown -15 %
- Attack cooldown -10 %
- Occupy cooldown -10 %
- Dirty cash from robbery +10 %
- Defense power -10 %
- Heat from attacks, occupy and robberies +8 %
- Special action: Bleskový nájezd

Status:

- Cooldowns, robbery dirty-cash bonus and defense penalty are active.
- Aggressive heat penalty is active for attacks, occupy and heists.
- Bleskový nájezd is preview-only and disabled.

Risk:

- Copy now matches the actual surface area: attack, occupy and heist heat.

### Soukromá Armáda

Promises:

- Attack power +12 %
- Defense power +12 %
- Equipment losses -10 %
- Heat from attacks and occupy +8 %
- Clean income -8 %
- Occupy power +10 %
- Upkeep/combat cost +12 %
- Special action: Taktické nasazení

Status:

- Attack, defense, equipment loss, aggressive heat and clean income penalty are active.
- Occupy power is planned.
- Upkeep/combat cost is planned.
- Taktické nasazení is preview-only and disabled.

Risk:

- Description mentions occupation strength. Current active occupation advantage is cooldown, not power, and the power modifier is not applied.

### Korporát

Promises:

- Clean income +15 %
- Heat gain -3 %
- Defense systems +10 %
- Dirty income -15 %
- Robbery loot -10 %
- Attack duration +10 %
- Market fee -10 %
- Special action: Právní štít

Status:

- Clean income, dirty penalty, defense system bonus, robbery loot penalty and attack duration penalty are active.
- Heat reduction is active for attack/heist heat, building action heat and fixed building passive heat, but not occupy heat.
- Market fee is planned.
- Právní štít is preview-only and disabled.

Risk:

- "Market efficiency" should not be sold as active until market fees consume `marketFeeMultiplier`.

## UI Findings

Fixed in this pass:

- Kult market fee was visible in the legacy disadvantage list as an active disadvantage even though the canonical read model marks it planned. It is now `plannedDisadvantages`.
- The faction action modal in `game.html` keeps unique protocols visible but states that passive effects run automatically and special protocols arrive later.
- The faction selection preview now splits content into `Funguje teď`, `Slabina`, `Připravuje se` and `Speciální schopnost — preview`.
- The faction selection preview no longer duplicates active advantages by mixing `coreBackedEffects` and `advantages`.
- Motorkářský gang heat copy now includes occupy because the aggressive heat multiplier is applied there too.
- Mafián/Korporát heat copy now says where the heat reduction applies instead of implying a fully global heat modifier.
- Kartel illegal production copy now says it applies to supported illegal production buildings.
- Hackeři rumor truth copy now says it applies to rumor events with `truthChancePct`.
- Player-facing faction copy no longer uses technical labels such as `core-backed`.
- The debug passive audit now documents heist heat and occupy heat surfaces accurately.

Still acceptable for alpha:

- The faction selection page clearly says special abilities are preview.
- The game modal disables the special action button and labels it as planned.
- The read model separates `activePassiveEffects` and `plannedPassiveEffects`.

## Viditelné Plánované Efekty

Plánované efekty a speciální schopnosti zůstávají v UI, protože tvoří identitu frakce a dávají hráči důvod vybrat si styl hry. V alphě ale musí být oddělené od skutečně běžících pasiv.

Co funguje teď:

- Aktivní pasivní modifikátory vypsané v sekci `Funguje teď`.
- Aktivní slabiny vypsané v sekci `Slabina`.
- Server-side uložení frakce a read model frakce.
- Automatické pasivy pro economy, heat, combat, spy, heist, production, population a rumor truth podle aktuální coverage.

Co je preview-only:

- Tichá dohoda.
- Noční zásilka.
- Masová posedlost.
- Spící buňka.
- Výpadek systému.
- Bleskový nájezd.
- Taktické nasazení.
- Právní štít.

Co se nesmí prezentovat jako hotové:

- Kult: silnější generování drbů/podezření a `+10 % market fee`.
- Tajná organizace: vyšší kvalita spy reportu a nižší heat z tajných akcí.
- Soukromá armáda: `+10 % occupy power` a `+12 % upkeep / combat cost`.
- Korporát: `-10 % market fee`.
- Jakákoliv speciální schopnost jako spustitelný command nebo aktivní efekt.

Proč zůstávají v UI:

- Hráč vidí kompletní fantasy frakce už při výběru.
- Alpha nepůsobí prázdně, ale zároveň nelže o funkčních efektech.
- Planned položky se dají testovat jako očekávání hráčů před další fází vývoje.

Co sledovat v alpha testu:

- Jestli hráči chápou rozdíl mezi `Funguje teď` a `Připravuje se`.
- Jestli preview schopnosti nepůsobí jako rozbité tlačítko.
- Jestli názvy plánovaných efektů nevyvolávají dojem, že už mění ekonomiku, market nebo combat.
- Jestli omezené efekty, hlavně heat a rumor truth, hráči čtou správně.

## Exploit And Integrity Risks

- Special actions must remain disabled until they are server-authoritative commands.
- Planned modifiers must not be displayed as active effects.
- Client/local selected faction must not authorize gameplay changes. Current gameplay slice bootstrap normalizes and persists faction server-side.
- Future market fee, upkeep, secret action and occupy power implementations need tests proving they affect only the intended systems.
- `heatGainMultiplier` wording should be narrowed or occupy heat should be wired through the same helper before claiming fully global heat control.

## Alpha Checklist

- Passive faction identity: ready.
- Faction selection and locked faction persistence: ready.
- Legacy/public definition sync: ready.
- Active/passive read model separation: ready.
- Special faction actions: preview-only, not ready.
- Market fee modifiers: not ready.
- Upkeep/combat-cost modifiers: not ready.
- Spy info quality layer: not ready.
- Rumor generation multiplier: not ready.
- Occupy power multiplier: not ready.

## Recommendation

Almost ready for alpha preview.

Ship factions as passive playstyle identities with clear preview labels on special actions. Do not market them as a complete active ability system yet. Before production, either wire the planned modifiers server-side or keep them visibly separated from active promise surfaces.
