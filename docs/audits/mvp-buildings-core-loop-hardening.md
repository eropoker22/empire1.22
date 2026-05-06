# MVP Buildings + Core Loop Hardening

Date: 2026-05-06

## Scope

This sprint stayed core/config first. Browser/runtime was treated as a renderer and command caller; no attack math, spy math, capture logic, map geometry, win condition, police raid calculation, or market price rule was changed.

Follow-up balance sprint: `docs/audits/free-session-balance-anti-snowball.md` now validates the same MVP building loop inside deterministic 15/60 minute FREE-session scenarios. No building balance config value was changed; current production, dirty cash, craft, heat, and police pacing passed the MVP assertions.

ID mapping used by the repo:

- `exchange` in building catalog and map sets uses `balance.exchangeOffice` config and `exchangeOffice` core metadata.
- `apartment_block`, `pharmacy`, `drug_lab`, `factory`, `armory`, `warehouse`, `casino`, `arcade`, `smuggling_tunnel`, `restaurant`, `convenience_store`, `clinic`, `fitness_club`, and `power_station` match the requested IDs.

## Building Matrix

| buildingId | catalog | config | core | UI | storage | heat | test | status | next fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| apartment_block | yes | fixed + `apartmentBlock` action config | `resolveApartmentBlockAction`, passive population production | district/building projections and building detail | stores local population in building metadata, collects to population + `gang-members` | no heat by design | existing building action tests + MVP matrix | ready | Balance population pacing after real player sessions. |
| pharmacy | yes | fixed + production + craft + building actions | passive `chemicals`, `stim-pack` craft, special actions | production/craft slot projection | player resource storage with warehouse cap on collect | action heat from config | production collect + MVP matrix | ready | Consider second passive output only if design needs biomass outside action/craft. |
| drug_lab | yes | fixed + production + craft + building actions | passive `neon-dust`, drug/boost craft, high-risk actions | production/craft slot projection | player resource storage | action heat from config, feed hook for significant production | MVP city feed/action test | ready | Balance heat versus output values later. |
| factory | yes | fixed + production + craft + building actions | passive `metal-parts`, `tech-core`/`combat-module` craft, power-station speed support | production/craft slot projection | player resource storage with warehouse cap | action/passive fixed heat from config | production collect + MVP matrix | ready | None for MVP. |
| armory | yes | fixed + craft + building actions | equipment craft, fortify action, power-station speed support | craft slot projection, attack/defense inventory remains existing flow | player resource storage | action heat from config, craft feed hook for significant equipment | MVP craft/feed test | ready | Optional clearer item-use affordance in UI later. |
| warehouse | yes | fixed + `warehouse` config | storage capacity resolver and collect caps | building stats/resources panel paths | caps chemicals, biomass, metal parts, tech core, modules, drugs/boosts, weapons/defense | passive fixed heat from config | existing warehouse cap test + MVP matrix | ready | Overflow remains capped/left in source building; fuller UX copy is TODO. |
| exchange | yes | fixed + `exchangeOffice` action config | dynamic laundering with network/audit metadata | building action projection | dirty cash consumed, clean cash added | action heat to district and PoliceReadModel | new unified payload/police test | ready | None for MVP. |
| casino | yes | fixed + `casino` action config | high-risk laundering, VIP boost, inspector action, audit checks | building action projection | dirty cash consumed, clean cash added | action/audit heat to district and police state | existing casino tests + MVP matrix | ready | Tune audit thresholds later. |
| arcade | yes | fixed + `arcade` action config | smaller laundering, night-machine boost, audit checks | building action projection | dirty cash consumed, clean cash added | action/audit heat to district and police state | existing arcade tests + MVP matrix | ready | None for MVP. |
| smuggling_tunnel | yes | fixed + `smugglingTunnel` action config | dirty batch production, collect, silent channel risk | building action projection and stats | local dirty cash batch in metadata, collect to player dirty cash | collect/passive heat from config | existing smuggling tests + MVP matrix | ready | City feed only for significant action output, not every passive batch. |
| restaurant | yes | fixed + `restaurant` config | passive clean income/influence and passive rumors | building stats/detail projection | no item storage by design | passive fixed heat from config | existing restaurant tests + MVP matrix | ready | Browser copy clarity can improve later. |
| convenience_store | yes | fixed + `convenienceStore` config | passive clean/dirty income, influence and passive rumors | building stats/detail projection | no item storage by design | passive fixed heat from config | existing convenience tests + MVP matrix | ready | Browser copy clarity can improve later. |
| clinic | yes | fixed + `clinic` action config | recovery pool support via stabilization protocol | building action projection | can restore supported loss pools/items | action/passive heat from config | existing clinic tests + MVP matrix | ready | Recovery UX can be clearer after more combat testing. |
| fitness_club | yes | fixed + `fitnessClub` config | income and combat conditioning support stats | building stats/detail projection | no item storage by design | passive fixed heat from config | existing projection coverage + MVP matrix | ready | Verify final attack/defense display after balancing. |
| power_station | yes | fixed + `powerStation` action config | production/storage/support multipliers and backup grid action | building action/stats projection | no item storage by design, affects production/storage capacity | action/passive heat from config | existing power/factory test + MVP matrix | ready | None for MVP. |

## Implemented Hardening

- Building action report payloads now include a unified safe shape: `success`, `buildingId`, `buildingType`, `buildingTypeId`, `actionId`, `buildingActionId`, `resourceDelta`, `cashDelta`, `dirtyCashDelta`, `heatDelta`, `influenceDelta`, `producedItems`, `consumedItems`, `cooldownUntilTick`, `message`, and `policeImpact`.
- Numeric payload fields are sanitized before storage/projection, so partial reports do not produce `NaN`.
- `PoliceReadModel` already reflected building action heat through player police heat and district heat; the new test locks that path.
- City feed generation now treats significant drug-lab actions, laundering actions, armory actions, and completed significant craft outputs as feed-worthy while keeping existing `sourceEventId` dedupe.
- Duplicate feed appends remain idempotent through `appendCityFeedEventsFromCoreEvents`.

## Core Loop Status

- Production path: `pharmacy` -> chemicals, `factory` -> metal parts, `drug_lab` -> neon dust; collection respects warehouse capacity.
- Dirty cash path: `casino`, `arcade`, `exchange`, and `smuggling_tunnel` mutate dirty/clean cash in core handlers and pass heat into district/police state.
- Craft/equipment path: `factory` components feed `armory` recipes; completed armory outputs reach player inventory and can be seen by existing attack/defense surfaces.
- Heat/police path: building action heat is config-backed and applied to district heat and player police heat; PoliceReadModel aggregates both.
- City feed path: significant building/craft events become deduped `CityFeedEvent` entries; passive rumor metadata for restaurant/convenience store remains non-gameplay.
- Free-session pacing path: first collect/craft/spy/attack is now covered by `tests/unit/game-core/free-session-balance-anti-snowball.test.ts`; new-player timing is minute `2/6/10/12`, and alliance push remains below the 85% win condition at 60 minutes.

## Changed Files

- Core: `packages/game-core/src/handlers/useBuildingAction.ts`, `packages/game-core/src/handlers/buildingActionReportNotification.ts`, `packages/game-core/src/projections/conflict-report-projection.ts`, `packages/game-core/src/rules/events/cityFeedEventGenerator.ts`, `packages/game-core/src/rules/events/buildingCityFeedEvents.ts`
- Shared types: `packages/shared-types/src/views/report-view.ts`
- Tests: `tests/integration/game-core/mvp-buildings-core-loop-hardening.test.ts`
- Docs: this file, `docs/audits/free-session-readiness.md`, `docs/audits/runtime-next-sprint.md`

## Verification

Passed during this sprint:

- `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\integration\game-core\mvp-buildings-core-loop-hardening.test.ts`
- `npm run typecheck`
- `npm run smoke:ui`
- `npm run lint:architecture`
- `npm run lint:file-sizes`
- `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\integration\game-core\building-action-flow.test.ts tests\integration\game-core\production-collect-flow.test.ts tests\integration\game-core\craft-item-flow.test.ts tests\unit\game-core\city-feed-event-generator.test.ts tests\read-models\police-read-model.test.ts`
- `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\unit\game-core\free-session-balance-anti-snowball.test.ts`

## Remaining Risks

- Buildings outside MVP still rely on the same fixed-building catalog/action patterns but were not rebalanced.
- Runtime legacy panels still contain old fallback display paths; they should remain display-only.
- Balancing is intentionally not final.
- Free-session snowball risk is currently medium: police/raid pressure brakes leaders, but real multiplayer should validate whether per-target attack routing feels too chainable.
- UI clarity around storage overflow and exact item use can improve after manual free-session play.

## Manual Checklist

1. Open free mode.
2. Click an owned district.
3. Open `apartment_block`.
4. Collect population.
5. Open `pharmacy`.
6. Collect resources.
7. Open `factory`.
8. Collect components.
9. Open `armory`.
10. Craft a basic item.
11. Open `casino` or `exchange`.
12. Run a dirty cash action.
13. Verify heat/police feedback.
14. Verify storage/resources refresh.
15. Verify city feed event.
16. Click an enemy district.
17. Verify attack/spy UI still opens.
