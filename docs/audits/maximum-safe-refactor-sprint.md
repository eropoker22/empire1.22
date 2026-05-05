# Maximum Safe Refactor Sprint

Date: 2026-05-05

## 10 Percent Safe Reduction Follow-up

- Runtime before follow-up: 14,260 lines
- Runtime after follow-up: 12,790 lines
- Removed from runtime: 1,470 lines
- Reduction: 10.31%
- New modules:
  - `map/mapCanvasAnimations.js`: map-only activity animations and badge drawing helpers.
  - `map/districtCanvasRenderer.js`: pure canvas paint pass for districts.
  - `ui/runtimePopupBinders.js`: popup/topbar shell binders for settings, profile, alliance, storage, logout and spy-resource toggle.
- High-risk still left in runtime: `bindDistrictCanvas` click/hover/state/action bridge, `bindGangWantedStatus` heat mutation and police trigger logic, production/building action mutations, attack/spy/robbery completion timers.
- Verification passed: `npm run typecheck`, `npm run lint:architecture`, `npm run lint:file-sizes`, `npm run smoke:ui`, `npm run test:unit`.

## Canonical Source

- Canonical runtime: `page-assets/js/app/runtime.js`
- Generated publish copy: `client/page-assets/js/app/runtime.js`
- Rule followed: `client/` was not edited by hand; regenerate it through the page build when publishing.

## Runtime Size

- Runtime before this sprint: 14,599 lines
- Runtime after this sprint: 14,529 lines
- Removed in this sprint: 70 lines
- Sprint reduction: 0.48%
- Current Git `HEAD` baseline for this checkout: 17,012 lines
- Current working tree reduction against Git `HEAD`: 2,483 lines, 14.60%

Follow-up market action orchestrator pass:

- Runtime before follow-up: 14,529 lines
- Runtime after follow-up: 14,323 lines
- Removed in follow-up: 206 lines
- Follow-up reduction: 1.42%
- `bindMarketPopup` before follow-up: 473 lines
- `bindMarketPopup` after follow-up: 262 lines
- Removed from `bindMarketPopup`: 211 lines

Follow-up market stock/dashboard adapter pass:

- Runtime before follow-up: 14,323 lines
- Runtime after follow-up: 14,298 lines
- Removed in follow-up: 25 lines
- `bindMarketPopup` before follow-up: 262 lines
- `bindMarketPopup` after follow-up: 229 lines
- Removed from `bindMarketPopup`: 33 lines

Super safe MVP hardening follow-up:

- Runtime before follow-up: 14,298 lines
- Runtime after follow-up: 14,260 lines
- Removed in follow-up: 38 lines
- `bindMarketPopup` after follow-up: 222 lines
- Full unit result after follow-up: 65 files, 262 tests passed.

The requested 30-50% reduction was not safe in this sprint. The remaining large blocks are mostly mixed gameplay/state mutation and UI orchestration; moving them wholesale would move attack, spy, market, production, ownership or map behavior instead of only UI/view-model code.

## Largest Functions After Sprint

1. `bindDistrictCanvas`: 3,080 lines
2. `bindMarketPopup`: 222 lines after market action callback, stock/dashboard adapter and popup payload extraction
3. `applyDistrictBuildingSpecialAction`: 456 lines
4. `resolveDistrictBuildingDetailMechanics`: 286 lines
5. `renderDistrictCanvas`: 247 lines
6. `bindProductionBuildingPopup`: 194 lines
7. `bindGangWantedStatus`: 192 lines
8. `renderMarketTab`: 191 lines
9. `bindFactoryPopup`: 167 lines
10. `completeAttackOrder`: 160 lines
11. `initCompatibilityGlobals`: 150 lines
12. `openPopup` inside `bindDistrictCanvas`: 144 lines
13. `collectDistrictBuildingDetailOutput`: 134 lines
14. `completeSpyMission`: 129 lines
15. `renderPlayerMarketTab`: 124 lines
16. `openGenericDistrictBuildingDetail`: 119 lines
17. `bindFactionRegistration`: 110 lines
18. `bindPlayerProfilePopup`: 107 lines
19. `syncStartPhaseResourceSimulation`: 107 lines
20. `bindBuildingActionStatus`: 106 lines
21. `drawAttackDistrictAnimation`: 104 lines
22. `drawPoliceDistrictAnimation`: 103 lines
23. `drawReducedMapActivityIcon`: 101 lines
24. `getDistrictEconomySnapshot`: 96 lines
25. `bindSettingsModal`: 95 lines
26. `applyAttackAction`: 89 lines
27. `completeRobberyOrder`: 88 lines
28. `bindCityStatusBar`: 85 lines
29. `createProductionCard`: 82 lines
30. `bindRegisteredPlayerState`: 79 lines

## Public Window API

Runtime compatibility remains centralized through:

- `window.EmpireRuntime`
- `window.EmpireRuntimeModules`
- legacy aliases registered by `runtime/compatibility.js`: `bootstrapPage`, `initRuntime`, `refreshAllUi`, `handleActionResult`, `showToast`, `showNotification`, `showSuccess`, `showError`, `showWarning`, `showInfo`, `clearNotifications`
- legacy bridges outside this sprint: `window.empireStreetsPage`, `window.empireStreetsDistrictState`, `window.empireStreetsAllianceState`, `window.empireStreetsBountyState`, `window.Empire`, `window.EmpireGameplaySliceClient`, `window.EmpireAdminSliceDemo`

No inline HTML event handlers were introduced.

## Category Map

A) boot/init: `initRuntime`, `bootstrapPage`, `bindUiEvents` remain in runtime.
B) global state: timers, queues and weak maps remain in runtime.
C) public handlers: `runtime/compatibility.js` now provides safe handler registration, unregister, registry and assertions.
D) refresh/render pipeline: map UI pipeline exists; broader runtime pipeline remains high-risk until action flows are narrower.
E) action result handling: police action result rendering moved to UI module; result queue/timers remain in runtime.
F) map UI: shell, tooltip, status, popup flags and action hub payloads are modularized.
G) map core renderer: left in runtime.
H) selected district UI: summary/action/popup flags are delegated; selection mutation remains in runtime.
I) district action hub: UI module exists; action availability stays in runtime.
J) building panels: existing modules remain in use.
K) production/recipe UI: existing modules remain in use.
L) market UI: panel/view-model/action-callback modules exist; buy/sell/listing storage mutations remain runtime dependency callbacks.
M) combat UI: attack/spy panel modules exist; combat result math remains in runtime/core.
N) robbery/heist UI: mostly still in runtime because action creation mutates state.
O) trap/defense UI: mostly still in runtime because trap and defense mutations are coupled.
P) wanted/police UI: wanted panel exists; police result panel added in this sprint.
Q) event feed/drby UI: existing event feed/gossip helpers remain.
R) profile/resources/storage UI: existing panel modules remain.
S) demo/dev UI: demo scenario data is already outside runtime; debug flow remains guarded.
T) persistence/localStorage: existing `persistence/legacyStorage.js`; keys unchanged.
U) helpers/constants/labels: many helpers already extracted; no balance constants changed.
V) server/API sync: not moved.
W) high-risk gameplay: attack/spy/robbery/market/production/ownership/police calculations unchanged.

## What Moved In This Sprint

- Police action result modal DOM rendering, tone class handling, row rendering and city-event live row rendering moved to `page-assets/js/app/ui/policeActionResultPanel.js`.
- Factory dashboard labels, button state rendering and slot list handoff moved to `page-assets/js/app/ui/factoryPanel.js`.
- Factory dashboard read-only view-model assembly moved to `page-assets/js/app/runtime/factoryViewModel.js`.
- Runtime compatibility public handler utilities were expanded in `page-assets/js/app/runtime/compatibility.js`.

Follow-up:

- Market player listing callback orchestration moved to `page-assets/js/app/runtime/marketActionOrchestrator.js`.
- Normal/black market buy and sell callback orchestration moved to `page-assets/js/app/runtime/marketActionOrchestrator.js`.
- Market transaction and listing-total helpers moved to `page-assets/js/app/runtime/marketActionOrchestrator.js`.
- Runtime still supplies all mutation dependencies: inventory, economy, market state commit, stock normalization, heat and topbar refresh.
- Market stock amount/max/label/percent helpers moved to `page-assets/js/app/runtime/marketStockViewModel.js`.
- Market dashboard stock summary and dashboard adapter payload moved to `page-assets/js/app/runtime/marketStockViewModel.js`.
- Black-market heat risk table lookup moved to `page-assets/js/app/runtime/marketStockViewModel.js`; actual heat writes still stay in runtime dependencies.
- Market popup player-listing and catalog panel payload assembly moved to `page-assets/js/app/runtime/marketPopupViewModel.js`.
- Production/factory info payload assembly moved to `page-assets/js/app/runtime/productionInfoViewModel.js`.
- Public `handleActionResult` now normalizes partial result payloads through `page-assets/js/app/runtime/actionResultOrchestrator.js`.
- Free-session readiness classification moved to `page-assets/js/app/dev/freeSessionChecklist.js`.

## What Stayed In Runtime

- Police result queue, live timer ownership, auto-close and building action feed side effects.
- Factory production sync, stored factory state, supplies, collect and upgrade mutations.
- Market price refresh, stock normalization, inventory/economy writes, heat writes and market state commit dependencies.
- Main map renderer, pointer handlers, selected district mutation, ownership and action dispatch.
- Attack/spy/robbery/trap/defense calculations and result application.

## New/Updated Files

- `page-assets/js/app/ui/policeActionResultPanel.js`
- `page-assets/js/app/ui/factoryPanel.js`
- `page-assets/js/app/runtime/factoryViewModel.js`
- `page-assets/js/app/runtime/compatibility.js`
- `tests/unit/runtime-police-action-result-panel.test.js`
- `tests/unit/runtime-factory-panel.test.js`
- `tests/unit/runtime-compatibility.test.js`
- `page-assets/js/app/runtime/marketActionOrchestrator.js`
- `tests/unit/runtime-market-action-orchestrator.test.js`
- `page-assets/js/app/runtime/marketStockViewModel.js`
- `tests/unit/runtime-market-stock-view-model.test.js`
- `page-assets/js/app/runtime/marketPopupViewModel.js`
- `tests/unit/runtime-market-popup-view-model.test.js`
- `page-assets/js/app/runtime/productionInfoViewModel.js`
- `tests/unit/runtime-production-info-view-model.test.js`
- `page-assets/js/app/runtime/actionResultOrchestrator.js`
- `tests/unit/runtime-action-result-orchestrator.test.js`
- `page-assets/js/app/dev/freeSessionChecklist.js`
- `tests/unit/runtime-free-session-checklist.test.js`
- `page-assets/js/app/runtime.js`

## Verification

Passed:

- `node --check page-assets/js/app/runtime.js`
- `node --check page-assets/js/app/ui/policeActionResultPanel.js`
- `node --check page-assets/js/app/runtime/factoryViewModel.js`
- `node --check page-assets/js/app/ui/factoryPanel.js`
- `node --check page-assets/js/app/runtime/compatibility.js`
- `node --check page-assets/js/app/runtime/marketActionOrchestrator.js`
- `node --check page-assets/js/app/runtime/marketStockViewModel.js`
- `node --check page-assets/js/app/runtime/marketPopupViewModel.js`
- `node --check page-assets/js/app/runtime/productionInfoViewModel.js`
- `node --check page-assets/js/app/runtime/actionResultOrchestrator.js`
- `node --check page-assets/js/app/dev/freeSessionChecklist.js`
- `node --check tests/unit/runtime-market-action-orchestrator.test.js`
- `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\unit\runtime-police-action-result-panel.test.js tests\unit\runtime-factory-panel.test.js tests\unit\runtime-compatibility.test.js tests\unit\runtime-refactor-guard.test.js`
- `node scripts/run-local-bin.mjs vitest/vitest.mjs run tests/unit/runtime-market-action-orchestrator.test.js tests/unit/runtime-market-view-model.test.js tests/unit/runtime-market-panel.test.js`
- `node scripts/run-local-bin.mjs vitest/vitest.mjs run tests/unit/runtime-market-stock-view-model.test.js tests/unit/runtime-market-view-model.test.js tests/unit/runtime-market-action-orchestrator.test.js tests/unit/runtime-market-panel.test.js`
- `npm run typecheck`
- `npm run lint:architecture`
- `npm run lint:file-sizes`
- `npm run smoke:ui`
- `npm run test:unit`

Full unit result after super safe MVP hardening follow-up: 65 files, 262 tests passed.

## Manual Checklist

1. Login/lobby/game boot.
2. Enter free mode.
3. Verify map renders.
4. Click owned district.
5. Click enemy district.
6. Hover district tooltip.
7. Open building detail.
8. Collect production.
9. Craft recipe.
10. Open market and buy/sell.
11. Create and cancel a player-market listing.
12. Buy a player-market listing with clean cash.
13. Buy a player-market listing with dirty cash and verify heat feedback.
14. Open spy panel.
15. Open attack panel.
16. Verify battle report.
17. Verify heat/wanted panel.
18. Verify police result/feed/warning modal.
19. Verify event feed/drby.
20. Verify storage/resources refresh.
21. Verify profile popup.
22. Verify overlay toggles.
23. Verify factory dashboard, collect and upgrade buttons.
24. Verify demo mode is not active unless selected.
25. Verify console has no fatal errors.

## Next Recommendation

The next safe high-impact step is to extract read-only wanted/police status view-model assembly from `bindGangWantedStatus` into `runtime/policeViewModel.js`, while keeping gang heat mutation, police pressure timers, raid calculations and storage writes in runtime.
