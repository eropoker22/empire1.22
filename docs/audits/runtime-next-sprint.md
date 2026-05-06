# Runtime Next Sprint

Date: 2026-05-05

## MVP Buildings + Core Loop Hardening Follow-up

- Status after hardening: ready for MVP core loop, with UI clarity follow-ups still useful.
- Audit: `docs/audits/mvp-buildings-core-loop-hardening.md`
- Core/config source of truth:
  - building catalog and fixed stats in `packages/game-config/src/public/building-definitions.ts`
  - production/craft config in `packages/game-config/src/base/base-balance-config.ts`
  - free-specific building action overrides in `packages/game-config/src/modes/free/free-mode.override.ts`
  - authoritative action handling in `packages/game-core/src/handlers/useBuildingAction.ts`
- Runtime boundary:
  - runtime should continue to render building detail/production/craft/actions from projections,
  - runtime must not recompute production, dirty cash conversion, heat, police pressure, craft output, or storage acceptance,
  - missing/partial building data should stay a no-crash display fallback, not a local gameplay rule.
- Implemented in this follow-up:
  - unified building action report payload with resource/cash/dirty cash/heat/influence deltas, produced/consumed items, cooldown tick, message and police impact,
  - significant drug-lab, laundering, armory and craft-completion city feed hooks with existing `sourceEventId` dedupe,
  - targeted MVP matrix and core-loop integration tests.
- Safe next runtime work:
  - expose stable recipe IDs in legacy craft cards so `craftItem(recipeId)` can target a specific recipe,
  - make warehouse overflow/cap text clearer in the storage panel,
  - improve attack/defense item display labels after balancing,
  - keep all of the above projection/UI-only.
- Verification passed so far:
  - `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\integration\game-core\mvp-buildings-core-loop-hardening.test.ts`
  - `npm run typecheck`
  - `npm run smoke:ui`
  - `npm run lint:architecture`
  - `npm run lint:file-sizes`
  - `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\integration\game-core\building-action-flow.test.ts tests\integration\game-core\production-collect-flow.test.ts tests\integration\game-core\craft-item-flow.test.ts tests\unit\game-core\city-feed-event-generator.test.ts tests\read-models\police-read-model.test.ts`

## Rumors + City Feed Integration Follow-up

- Status after integration: partial, MVP city feed is wired.
- Core source of truth:
  - `packages/shared-types/src/entities/city-feed-event.ts`
  - `packages/game-core/src/rules/events/cityFeedEventGenerator.ts`
  - `packages/game-core/src/projections/city-feed-projection.ts`
- Runtime bridge:
  - `page-assets/js/app/runtime/eventRumorBridge.js`
  - `page-assets/js/app/ui/rumorFeedPanel.js`
- Runtime rules:
  - core `cityFeed` projection is preferred,
  - local runtime rumors are fallback only,
  - runtime does not change combat, spy, police, market, ownership, or resource outcomes,
  - fallback rumors are deduped by deterministic source key and stored under `empireStreets.cityFeed.v1`.
- Safe next work:
  - wire old server market/heist `rumors` arrays into `CityFeedEvent` storage when those systems are migrated behind core command/tick flow,
  - add real browser verification for feed ordering after attack/spy/raid,
  - populate faction/alliance visibility metadata when those read models become authoritative in the free-session slice.
- Verification passed:
  - `npm run typecheck`
  - `npm run smoke:ui`
  - `npm run lint:architecture`
  - `npm run lint:file-sizes`
  - `npm run test:unit` - 98 files, 359 tests.

## Free Session Manual UX Pass Follow-up

- Status after manual browser pass: ready for MVP free-session click loop.
- Browser verification script:
  - `scripts/free-session-ux-pass.mjs`
  - Runs headless Chromium/Edge through CDP pipe.
  - Seeds an isolated FREE session in a temporary browser profile.
  - Uses public handlers and live DOM controls against `pages/game.html`.
  - Fails validation on missing public handlers, broken storage/topbar refresh, missing spy/attack reports, misleading attack heat `+0`, missing police feedback, incomplete checklist, or page console warnings/errors.
- Verified in browser:
  - FREE session on `free-eu-01`, not demo mode.
  - Owned district `27`.
  - Building detail opens.
  - Production/action click and storage open.
  - Adjacent enemy district opens.
  - Spy starts and returns a report.
  - Attack starts with a real loadout and returns a timed battle report.
  - Attack report now uses `Police feed` as the fallback heat row when no authoritative heat delta is present, instead of displaying `+0`.
  - Police feed renders high-risk feedback.
  - Gang profile stars get neon police-threat state.
  - Onboarding reaches `10/10`.
- Fixes made:
  - `collectProduction()` dispatches a UI-only onboarding event after successful click.
  - Onboarding bridge tracks production collection and storage open via delegated document click.
  - Static attack report payloads no longer show a fake `HEAT GAINED +0`; explicit heat values still render when provided by the payload.
- Remaining safe next work:
  - connect static/free browser attack result to core attack heat where server/core snapshot is authoritative, keeping the current `Police feed` fallback for legacy static sessions,
  - wire pending raid acknowledge from browser command transport in server-authority mode,
  - keep runtime police/heat as fallback display only.

## Free Session MVP Hardening Follow-up

- Status after hardening: partial, ready for manual browser smoke.
- Main additions:
  - `page-assets/js/app/ui/onboardingPanel.js`
  - `page-assets/js/app/runtime/onboardingBridge.js`
  - `page-assets/js/app/ui/policeFeedPanel.js`
  - `page-assets/js/app/runtime/policeHeatBridge.js`
  - `tests/unit/freeSessionMvpFlow.test.js`
  - `docs/audits/free-session-mvp-hardening.md`
- Runtime changes stayed UI/recovery scoped:
  - public window aliases now delegate to existing runtime handlers,
  - start district recovery restores ownership only from existing registration data,
  - action/result/heat UI events feed onboarding and police panels,
  - battle report payload/display fallbacks handle partial data.
- Gameplay calculations intentionally not changed:
  - attack/spy/capture/heat/police/cooldown/production/market formulas,
  - district ownership rules,
  - map geometry and colors,
  - demo/dev scenarios.
- Verification passed:
  - `npm run typecheck`
  - `npm run smoke:ui`
  - `npm run lint:architecture`
  - `npm run lint:file-sizes`
  - targeted free-session/runtime tests, 6 files / 25 tests.
  - full `npm run test:unit`, 92 files / 339 tests.
- Next sprint should not start another broad runtime refactor. First do the manual free-loop click-through and only then address concrete blockers found there.

## Core-First Police Completion Follow-up

- Status after implementation: ready for automated core/server/runtime checks; browser manual verification still recommended.
- Source of truth moved to core/config:
  - `packages/game-core/src/rules/police/policePressure.ts`
  - `packages/game-core/src/rules/police/triggerRaid.ts`
  - `packages/game-core/src/rules/police/raidLifecycle.ts`
  - `packages/game-core/src/rules/police/raidConsequences.ts`
  - `packages/game-config/src/base/base-balance-config.ts`
- Frontend projection path:
  - server exposes `player.police` and `police` in the gameplay slice,
  - runtime `policeHeatBridge` uses `PoliceReadModel` first,
  - old runtime heat/wanted calculation is legacy fallback only.
- Runtime must not regain police authority:
  - no raid trigger calculations in browser,
  - no raid consequence application in browser,
  - no district heat pressure rules in browser.
- Safe next work:
  - wire real `acknowledge-pending-raid` command from the browser client where server command transport is present,
  - add UI affordance for pending raid acknowledgement,
  - verify browser feed ordering and duplicate warning behavior.
- Verification passed:
  - `npm run typecheck`
  - `npm run smoke:ui`
  - `npm run lint:architecture`
  - `npm run lint:file-sizes`
  - `npm run test:unit` - 94 files, 348 tests.
  - `npm run test:integration` - 14 files, 86 tests.
  - `npm run test:read-models`

## 10 Percent Runtime Reduction Follow-up

- Canonical runtime: `page-assets/js/app/runtime.js`
- Generated runtime copy: `client/page-assets/js/app/runtime.js`; do not edit by hand.
- Runtime before follow-up: 14,260 lines
- Runtime after follow-up: 12,790 lines
- Removed from runtime: 1,470 lines
- Reduction: 10.31%
- Extracted modules:
  - `page-assets/js/app/map/mapCanvasAnimations.js`
  - `page-assets/js/app/map/districtCanvasRenderer.js`
  - `page-assets/js/app/ui/runtimePopupBinders.js`
- Updated tests:
  - `tests/unit/runtime-map-canvas-modules.test.js`
  - `tests/unit/runtime-popup-binders.test.js`
  - `tests/unit/runtime-refactor-guard.test.js`
  - `tests/unit/page-onboarding-smoke.test.js`

Safety note: the move kept state mutation and gameplay calculations in existing runtime/core paths. The extracted map renderer receives the same dependencies from runtime and only paints.

Verification: `typecheck`, `lint:architecture`, `lint:file-sizes`, `smoke:ui` and full `test:unit` passed.

## Canonical Source

- Canonical runtime: `page-assets/js/app/runtime.js`
- Generated runtime copy: `client/page-assets/js/app/runtime.js`
- Rule followed: `client/` was not edited by hand; regenerate it through the page build when publishing.

## Size

- Runtime before this sprint: 13,238 lines
- Runtime after this sprint: 13,135 lines
- Removed from runtime in this sprint: 103 lines

Follow-up read-only view-model extraction:

- Runtime before follow-up: 13,135 lines
- Runtime after follow-up: 13,128 lines
- Removed from runtime in this follow-up: 7 lines

Market read-only view-model follow-up:

- Runtime before market follow-up: 13,128 lines
- Runtime after market follow-up: 13,062 lines
- Removed from runtime in this market follow-up: 66 lines

District canvas UI shell follow-up:

- Runtime before district canvas follow-up: 13,062 lines
- Runtime after district canvas follow-up: 12,998 lines
- Removed from runtime in this district canvas follow-up: 64 lines
- `bindDistrictCanvas` before district canvas follow-up: 3,387 lines
- `bindDistrictCanvas` after district canvas follow-up: 3,292 lines
- Removed from `bindDistrictCanvas`: 95 lines

Map mission marker view-model follow-up:

- Runtime before marker follow-up: 12,998 lines
- Runtime after marker follow-up: 12,812 lines
- Removed from runtime in marker follow-up: 186 lines
- `bindDistrictCanvas` before marker follow-up: 3,292 lines
- `bindDistrictCanvas` after marker follow-up: 3,100 lines
- Removed from `bindDistrictCanvas` in marker follow-up: 192 lines

Map UI shell + refresh pipeline follow-up:

- Runtime baseline from current Git `HEAD`: 17,012 lines
- Runtime after map shell follow-up in the working tree: 14,596 lines
- Runtime delta against current Git baseline: -2,416 lines
- Current working tree note: earlier line totals in this document come from previous uncommitted audit passes; the Git `HEAD` baseline is the stable comparison for this checkout.
- `bindDistrictCanvas` before map shell follow-up, from previous audit: 3,100 lines
- `bindDistrictCanvas` after map shell follow-up: 3,091 lines
- Removed from `bindDistrictCanvas` in map shell follow-up: 9 lines

Map status view-model follow-up:

- Runtime after status view-model follow-up in the working tree: 14,621 lines
- Runtime delta against current Git baseline after status view-model follow-up: -2,391 lines
- `bindDistrictCanvas` after status view-model follow-up: 3,111 lines
- Runtime note: this follow-up added a small read-only orchestration bridge so map status can be built lazily after redraw if a status container exists.

Map tooltip view-model follow-up:

- Runtime after tooltip view-model follow-up in the working tree: 14,617 lines
- Runtime delta against current Git baseline after tooltip view-model follow-up: -2,395 lines
- `bindDistrictCanvas` after tooltip view-model follow-up: 3,103 lines
- Removed from `bindDistrictCanvas` in tooltip view-model follow-up: 8 lines

District popup flags view-model follow-up:

- Runtime after popup flags view-model follow-up in the working tree: 14,599 lines
- Runtime delta against current Git baseline after popup flags view-model follow-up: -2,413 lines
- `bindDistrictCanvas` after popup flags view-model follow-up: 3,081 lines
- Removed from `bindDistrictCanvas` in popup flags view-model follow-up: 22 lines

Maximum safe refactor sprint:

- Runtime before maximum sprint: 14,599 lines
- Runtime after maximum sprint: 14,529 lines
- Removed from runtime in maximum sprint: 70 lines
- Sprint reduction: 0.48%
- Current working tree reduction against Git `HEAD` baseline 17,012 lines: 2,483 lines, 14.60%
- `bindDistrictCanvas` after maximum sprint: 3,081 lines
- 30-50% reduction was not safe because the remaining large blocks are mixed gameplay/state mutation and UI orchestration.

Market action orchestrator follow-up:

- Runtime before market action follow-up: 14,529 lines
- Runtime after market action follow-up: 14,323 lines
- Removed from runtime in market action follow-up: 206 lines
- Follow-up reduction: 1.42%
- `bindMarketPopup` before market action follow-up: 473 lines
- `bindMarketPopup` after market action follow-up: 262 lines
- Removed from `bindMarketPopup`: 211 lines
- Safety boundary: price refresh, stock normalization, inventory/economy writes, heat writes and market state commits remain runtime dependencies passed into the new callback orchestrator.

Market stock/dashboard adapter follow-up:

- Runtime before stock adapter follow-up: 14,323 lines
- Runtime after stock adapter follow-up: 14,298 lines
- Removed from runtime in stock adapter follow-up: 25 lines
- `bindMarketPopup` before stock adapter follow-up: 262 lines
- `bindMarketPopup` after stock adapter follow-up: 229 lines
- Removed from `bindMarketPopup`: 33 lines
- Safety boundary: price refresh, market state persistence, stock normalization implementation and all inventory/economy/heat writes remain in runtime.

Super safe MVP hardening sprint:

- Runtime before sprint: 14,298 lines
- Runtime after sprint: 14,260 lines
- Removed from runtime in sprint: 38 lines
- Sprint reduction: 0.27%
- `bindMarketPopup` before sprint: 229 lines
- `bindMarketPopup` after sprint: 222 lines
- Added safety modules for market popup payloads, production/factory info payloads, action result normalization and free-session readiness.

## Largest Runtime Functions After Latest Follow-ups

- `bindDistrictCanvas`: 3,100 lines
- `bindMarketPopup`: 222 lines after market action callback, stock/dashboard adapter and popup payload extraction.
- `applyDistrictBuildingSpecialAction`: 456 lines
- `resolveDistrictBuildingDetailMechanics`: 286 lines
- `renderDistrictCanvas`: 247 lines
- `bindFactoryPopup`: 212 lines
- `bindProductionBuildingPopup`: 194 lines
- `bindGangWantedStatus`: 192 lines
- `completeAttackOrder`: 160 lines
- `collectDistrictBuildingDetailOutput`: 134 lines
- `completeSpyMission`: 129 lines
- `openGenericDistrictBuildingDetail`: 119 lines
- `bindPlayerProfilePopup`: 116 lines
- `syncStartPhaseResourceSimulation`: 107 lines
- `bindBuildingActionStatus`: 106 lines
- `bindFactionRegistration`: 105 lines
- `drawAttackDistrictAnimation`: 104 lines
- `drawPoliceDistrictAnimation`: 103 lines
- `drawReducedMapActivityIcon`: 101 lines
- `getDistrictEconomySnapshot`: 96 lines

## UI-Only Candidates

- Remaining wanted popup orchestration in `bindGangWantedStatus`.
- Auth/faction registration orchestration in `bindFactionRegistration`.
- Player popup view-model assembly in `bindPlayerProfilePopup`.
- Factory dashboard DOM wiring in `bindFactoryPopup`.
- Production building popup DOM wiring in `bindProductionBuildingPopup`.
- Market popup UI assembly in `bindMarketPopup`.
- Building action status panel shell in `bindBuildingActionStatus`.
- Police action modal DOM assembly in `openPoliceActionResultModal`.
- Result modal queue display wrappers around `queueOrOpenResultModal`.
- Map overlay/tooltip/status UI pieces inside `bindDistrictCanvas`.

## High-Risk Blocks Not Touched

- `bindDistrictCanvas`: map interaction, hover/click, selection and redraw coupling.
- `renderDistrictCanvas`: map drawing and ownership/visibility rendering.
- `applyDistrictBuildingSpecialAction`: rewards, cooldowns, heat and storage mutations.
- `resolveDistrictBuildingDetailMechanics`: production, passive income and building mechanics.
- `completeAttackOrder`: attack outcome and ownership mutation.
- `completeSpyMission`: spy/capture outcome and intel mutation.
- `syncStartPhaseResourceSimulation`: passive resource and heat accrual.
- Market buy/sell handlers inside `bindMarketPopup`: prices, inventory and heat.
- Police pressure functions: raid scheduling, protection and district police state.
- LocalStorage read/write helpers and keys.

## New Files

- `page-assets/js/app/ui/wantedPanel.js`
  - Renders heat badge, wanted levels, heat journal lists, wanted feedback and wanted popup read-only state.
- `page-assets/js/app/ui/authPanel.js`
  - Renders faction preview and auth status blocks.
- `tests/unit/runtime-wanted-panel.test.js`
  - Covers wanted panel no-crash and mock render state.
- `tests/unit/runtime-auth-panel.test.js`
  - Covers auth panel no-crash and faction preview render.
- `page-assets/js/app/runtime/playerProfileViewModel.js`
  - Builds player profile labels from read-only registration, resource, gang, district and alliance snapshots.
- `page-assets/js/app/runtime/authRegistrationViewModel.js`
  - Builds auth/faction registration status and faction preview labels.
- `page-assets/js/app/runtime/marketViewModel.js`
  - Builds market dashboard chips, scoped copy, item row labels, player listing view-models, row disabled/title labels and suggested player listing price display values.
- `tests/unit/runtime-market-view-model.test.js`
  - Covers dashboard/copy, item price labels, player listing states, trade disabled/title states and suggested listing price labels.
- `page-assets/js/app/map/districtViewModel.js`
  - Builds read-only district summary/action/owner/zone view-models.
- `page-assets/js/app/map/mapTooltip.js`
  - Renders, positions and hides district hover tooltip and tooltip gossip entries.
- `page-assets/js/app/ui/districtActionHub.js`
  - Renders district action buttons, disabled reasons, police lock state and action empty states.
- `page-assets/js/app/ui/selectedDistrictSummary.js`
  - Renders selected district summary header and no-selection fallback.
- `tests/unit/runtime-district-view-model.test.js`
- `tests/unit/runtime-map-tooltip.test.js`
- `tests/unit/runtime-district-action-hub.test.js`
- `tests/unit/runtime-selected-district-summary.test.js`
- `page-assets/js/app/map/mapMissionMarkersViewModel.js`
  - Builds read-only map marker Sets/Maps for spy, police, attack, occupy, robbery and trap map animations.
- `tests/unit/runtime-map-mission-markers-view-model.test.js`
  - Covers marker payloads and district id normalization without runtime state mutation.
- `page-assets/js/app/map/mapShell.js`
  - Handles safe map shell DOM lookup, interaction overlay creation, hover canvas creation and shell visual state sync.
- `page-assets/js/app/map/mapOverlayState.js`
  - Provides read-only/immutable overlay UI state helpers.
- `page-assets/js/app/map/mapOverlayControls.js`
  - Renders overlay control buttons and delegates clicks to runtime callbacks.
- `page-assets/js/app/map/mapStatusPanel.js`
  - Renders read-only map status rows and busy/error fallback messages.
- `page-assets/js/app/map/mapRefreshPipeline.js`
  - Centralizes safe map UI refresh ordering while leaving redraw/gameplay callbacks in runtime.
- `page-assets/js/app/map/mapStatusViewModel.js`
  - Builds read-only district count, owned count, enemy count, selected district label and overlay label from inputs supplied by runtime.
- `page-assets/js/app/map/mapTooltipViewModel.js`
  - Builds read-only hover tooltip id/type/gossip payload from district and interaction state supplied by runtime.
- `page-assets/js/app/map/districtPopupFlagsViewModel.js`
  - Builds selected district popup flag labels and tones from read-only inputs supplied by runtime.
- `page-assets/js/app/ui/policeActionResultPanel.js`
  - Renders police action result modal content, tone classes, rows and live city-event rows.
- `page-assets/js/app/ui/factoryPanel.js`
  - Renders factory dashboard labels, resource counters, button states and delegates slot rendering.
- `page-assets/js/app/runtime/factoryViewModel.js`
  - Builds factory dashboard labels and slot view-models from read-only factory state.
- `page-assets/js/app/runtime/marketActionOrchestrator.js`
  - Builds dependency-injected market callback sets for player listings, catalog buy and catalog sell flows without owning storage, economy, stock or heat mutation.
- `page-assets/js/app/runtime/marketStockViewModel.js`
  - Builds read-only stock amount/max/label/percent values, dashboard stock summaries, dashboard adapter input and heat-risk lookup from injected data.
- `page-assets/js/app/runtime/marketPopupViewModel.js`
  - Builds read-only player-market sellable item payloads and catalog item view-model payloads.
- `page-assets/js/app/runtime/productionInfoViewModel.js`
  - Builds production building info text payloads, recipe info lines and factory info rows.
- `page-assets/js/app/runtime/actionResultOrchestrator.js`
  - Normalizes partial action results, toast payloads and refresh hints without recalculating gameplay.
- `page-assets/js/app/dev/freeSessionChecklist.js`
  - Classifies free-session readiness as ready/partial/blocked from supplied state, DOM and runtime APIs.
- `tests/unit/runtime-map-shell.test.js`
- `tests/unit/runtime-map-overlay-controls.test.js`
- `tests/unit/runtime-map-status-panel.test.js`
- `tests/unit/runtime-map-refresh-pipeline.test.js`
- `tests/unit/runtime-map-status-view-model.test.js`
- `tests/unit/runtime-map-tooltip-view-model.test.js`
- `tests/unit/runtime-district-popup-flags-view-model.test.js`
- `tests/unit/runtime-police-action-result-panel.test.js`
- `tests/unit/runtime-factory-panel.test.js`
- `tests/unit/runtime-market-action-orchestrator.test.js`
  - Covers market transaction/listing helper output, player listing create/cancel/buy callback flow, catalog buy/sell callback flow, disabled row refreshes and missing-dependency no-crash behavior.
- `tests/unit/runtime-market-stock-view-model.test.js`
  - Covers stock label/percent fallbacks, dashboard stock summaries, dashboard adapter payloads and heat-risk lookup.
- `tests/unit/runtime-market-popup-view-model.test.js`
- `tests/unit/runtime-production-info-view-model.test.js`
- `tests/unit/runtime-action-result-orchestrator.test.js`
- `tests/unit/runtime-free-session-checklist.test.js`

## Updated Files

- `page-assets/js/app/runtime.js`
- `docs/audits/runtime-next-sprint.md`
- `docs/audits/maximum-safe-refactor-sprint.md`
- `docs/audits/runtime-orchestrator-hardening.md`

## What Moved

- Wanted/heat DOM rendering moved from `bindGangWantedStatus` to `ui/wantedPanel.js`.
- Auth status DOM rendering moved to `ui/authPanel.js`.
- Faction preview DOM rendering moved to `ui/authPanel.js`.
- Player profile read-only label assembly moved to `runtime/playerProfileViewModel.js`.
- Auth registration read-only status assembly moved to `runtime/authRegistrationViewModel.js`.
- Market dashboard/copy assembly moved to `runtime/marketViewModel.js`.
- Normal/black market item row label assembly moved to `runtime/marketViewModel.js`.
- Player market listing read-only state assembly moved to `runtime/marketViewModel.js`.
- Market row disabled/title/total label assembly moved to `runtime/marketViewModel.js`.
- Player market listing callback orchestration moved to `runtime/marketActionOrchestrator.js`.
- Normal/black market buy and sell callback orchestration moved to `runtime/marketActionOrchestrator.js`.
- Market transaction and player listing total helpers moved to `runtime/marketActionOrchestrator.js`.
- Market stock amount/max/label/percent helpers moved to `runtime/marketStockViewModel.js`.
- Market dashboard stock summary and adapter payload assembly moved to `runtime/marketStockViewModel.js`.
- Black-market heat risk table lookup moved to `runtime/marketStockViewModel.js`; heat mutation remains a runtime dependency callback.
- Market popup player-listing and catalog panel payload assembly moved to `runtime/marketPopupViewModel.js`.
- Production/factory info payload assembly moved to `runtime/productionInfoViewModel.js`.
- Public `handleActionResult` now uses `runtime/actionResultOrchestrator.js` for safe partial-result normalization.
- Free-session readiness checks moved to `dev/freeSessionChecklist.js`.
- District tooltip DOM update and positioning moved to `map/mapTooltip.js`.
- Selected district summary rendering moved to `ui/selectedDistrictSummary.js`.
- District action hub button rendering moved to `ui/districtActionHub.js`.
- District summary/action read-only payload mapping moved to `map/districtViewModel.js`.
- Map mission marker payload assembly moved to `map/mapMissionMarkersViewModel.js`.
- Map shell DOM lookup, hover canvas creation, interaction overlay creation and shell visual sync moved to `map/mapShell.js`.
- Overlay UI state and overlay control button rendering moved to `map/mapOverlayState.js` and `map/mapOverlayControls.js`.
- Map status rendering moved to `map/mapStatusPanel.js`.
- Map UI refresh ordering moved to `map/mapRefreshPipeline.js`.
- Map status view-model assembly moved to `map/mapStatusViewModel.js`.
- Map hover tooltip payload assembly moved to `map/mapTooltipViewModel.js`.
- Selected district popup flag payload assembly moved to `map/districtPopupFlagsViewModel.js`.
- Police action result modal rendering moved to `ui/policeActionResultPanel.js`.
- Factory dashboard rendering moved to `ui/factoryPanel.js`.
- Factory dashboard view-model assembly moved to `runtime/factoryViewModel.js`.
- Runtime public handler registry/guards moved into `runtime/compatibility.js`.

## What Stayed In Runtime

- Heat decay, heat reduction, money spending and police trigger side effects.
- Wanted popup event listeners and state refresh orchestration.
- Registration submit flow and localStorage mutations.
- Faction selection state, inventory initialization and server entry state.
- Player profile event binding and snapshot reads.
- Market popup lifecycle, active tab state, server badge wiring and refresh timer.
- Market buy/sell/listing/cancel handlers, inventory/cash mutation, stock mutation, transaction history mutation and black-market heat mutation.
- Map boot/binding, click/hover state, selected district state and map redraw.
- `window.empireStreetsDistrictState` capture/destroy/selection bridge.
- Attack/spy/robbery/trap/defense action handlers, calculations and persistence.
- Mission animation loop, redraw scheduling, order storage reads and mission completion side effects.
- Gameplay calculations, rewards, cooldowns, police state and district ownership.
- Overlay value calculations and actual redraw timing after overlay changes.

## Preserved Public API

Important compatibility paths remain:

- `window.EmpireRuntime`
- `window.EmpireRuntimeModules`
- `window.EmpireBuildingDetailPanel`
- `window.EmpireProductionPanel`
- `window.EmpireRecipePanel`
- `window.EmpireWantedPanel`
- `window.EmpireAuthPanel`
- `window.EmpireRuntimeModules.mapShell`
- `window.EmpireRuntimeModules.mapOverlayState`
- `window.EmpireRuntimeModules.mapOverlayControls`
- `window.EmpireRuntimeModules.mapStatusPanel`
- `window.EmpireRuntimeModules.mapStatusViewModel`
- `window.EmpireRuntimeModules.mapTooltipViewModel`
- `window.EmpireRuntimeModules.districtPopupFlagsViewModel`
- `window.EmpireRuntimeModules.policeActionResultPanel`
- `window.EmpireRuntimeModules.factoryPanel`
- `window.EmpireRuntimeModules.factoryViewModel`
- `window.EmpireRuntimeModules.mapRefreshPipeline`
- ESM exports including `applyFactionPreview`, `renderAuthStatus`, `replaceListItems`, `bindGangWantedStatus`, `bindFactionRegistration`, `bindDistrictCanvas`, `renderProductionPanel` and existing gameplay helpers.

## Verification Plan

- Syntax check changed modules.
- Unit tests for new UI modules.
- Runtime import/refactor guard.
- Full unit suite.
- Typecheck.
- Architecture lint.
- File-size lint.
- UI smoke.

## Test Results

Completed during the sprint:

- `node --check page-assets/js/app/runtime.js`
- `node --check page-assets/js/app/ui/wantedPanel.js`
- `node --check page-assets/js/app/ui/authPanel.js`
- `node --check page-assets/js/app/runtime/marketViewModel.js`
- `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\unit\runtime-auth-panel.test.js tests\unit\runtime-wanted-panel.test.js tests\unit\runtime-refactor-guard.test.js tests\unit\page-onboarding-smoke.test.js`
- `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\unit\runtime-market-view-model.test.js tests\unit\runtime-market-panel.test.js tests\unit\page-market-state.test.js tests\unit\runtime-refactor-guard.test.js`
- `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\unit\runtime-district-view-model.test.js tests\unit\runtime-map-tooltip.test.js tests\unit\runtime-district-action-hub.test.js tests\unit\runtime-selected-district-summary.test.js tests\unit\runtime-district-panel.test.js tests\unit\runtime-refactor-guard.test.js tests\unit\runtime-map-rendering.test.js`
- `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\unit\runtime-map-mission-markers-view-model.test.js tests\unit\runtime-map-rendering.test.js tests\unit\runtime-refactor-guard.test.js tests\unit\runtime-main-flow-smoke.test.js`
- `node --check page-assets/js/app/map/mapShell.js`
- `node --check page-assets/js/app/map/mapOverlayState.js`
- `node --check page-assets/js/app/map/mapOverlayControls.js`
- `node --check page-assets/js/app/map/mapStatusPanel.js`
- `node --check page-assets/js/app/map/mapRefreshPipeline.js`
- `node --check page-assets/js/app/map/mapStatusViewModel.js`
- `node --check page-assets/js/app/map/mapTooltipViewModel.js`
- `node --check page-assets/js/app/map/districtPopupFlagsViewModel.js`
- `node --check page-assets/js/app/ui/policeActionResultPanel.js`
- `node --check page-assets/js/app/runtime/factoryViewModel.js`
- `node --check page-assets/js/app/ui/factoryPanel.js`
- `node --check page-assets/js/app/runtime/compatibility.js`
- `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\unit\runtime-map-shell.test.js tests\unit\runtime-map-overlay-controls.test.js tests\unit\runtime-map-status-panel.test.js tests\unit\runtime-map-refresh-pipeline.test.js`
- `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\unit\runtime-map-status-view-model.test.js tests\unit\runtime-map-refresh-pipeline.test.js tests\unit\runtime-map-shell.test.js tests\unit\runtime-refactor-guard.test.js`
- `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\unit\runtime-map-tooltip-view-model.test.js tests\unit\runtime-map-tooltip.test.js tests\unit\runtime-refactor-guard.test.js`
- `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\unit\runtime-district-popup-flags-view-model.test.js tests\unit\runtime-refactor-guard.test.js`
- `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\unit\runtime-police-action-result-panel.test.js tests\unit\runtime-factory-panel.test.js tests\unit\runtime-compatibility.test.js tests\unit\runtime-refactor-guard.test.js`
- `npm run typecheck`
- `npm run lint:architecture`
- `npm run lint:file-sizes`
- `npm run test:unit`
- `npm run smoke:ui`

All listed checks passed. Latest unit suite result: 59 files, 236 tests.

## Known Risks

- Runtime is still dominated by map rendering and gameplay-coupled orchestration; a 15-30% reduction is not safe in one sprint without touching high-risk map, market or combat state.
- `client/` remains stale until regenerated by build output.
- Wanted and auth rendering are now callback/view-model driven, so manual browser checks should focus on disabled states and registration/wanted popup updates.
- Market UI label payloads are now builder-driven, so manual checks should focus on buy/sell disabled reasons, black-market heat preview copy and player listing titles.
- District tooltip, selected district summary and action hub are now delegated; manual checks should focus on hover tooltip positioning, action disabled states and opening attack/spy/building flows from selected districts.
- Map marker payloads are now builder-driven; manual checks should include active spy, attack, robbery, occupy, police and trap map indicators.
- Map shell and refresh pipeline are now delegated; manual checks should focus on map boot, hover canvas/focus overlay, single-click behavior and UI refresh after action results.

## Manual Checklist

1. Open login/lobby/game.
2. Enter free mode.
3. Select/open owned district.
4. Open building detail.
5. Collect production.
6. Open production building.
7. Show recipe list.
8. Click foreign district.
9. Open spy panel.
10. Open attack panel.
11. Show battle report.
12. Verify heat/wanted panel.
13. Verify police feed/modal.
14. Verify map still reacts.
15. Verify demo mode is not active unless intentionally selected.

## Next Step

The safest next refactor is to extract only read-only attack/robbery/spy confirm modal text builders. Avoid validation, cooldowns, storage, mission creation, district ownership, map renderer and police scheduling until they have stronger coverage.
