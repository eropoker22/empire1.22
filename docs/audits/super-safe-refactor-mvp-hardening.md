# Super Safe Refactor + MVP Hardening

Date: 2026-05-05

## Canonical Source

- Canonical runtime: `page-assets/js/app/runtime.js`
- Generated publish copy: `client/page-assets/js/app/runtime.js`
- Rule followed: `client/` was not edited by hand; regenerate it through the page build before publishing.

## Runtime Size

- Runtime before this sprint: 14,298 lines
- Runtime after this sprint: 14,260 lines
- Removed from runtime: 38 lines
- Reduction: 0.27%

This sprint intentionally prioritized safety and MVP hardening over aggressive line removal. The remaining largest functions still combine state mutation, timers, map interaction, and gameplay outcomes.

## Largest Runtime Functions After Sprint

1. `bindDistrictCanvas`: 3,080 lines
2. `applyDistrictBuildingSpecialAction`: 456 lines
3. `resolveDistrictBuildingDetailMechanics`: 286 lines
4. `renderDistrictCanvas`: 247 lines
5. `bindMarketPopup`: 222 lines
6. `bindProductionBuildingPopup`: 194 lines
7. `bindGangWantedStatus`: 192 lines
8. `bindFactoryPopup`: 167 lines
9. `completeAttackOrder`: 160 lines
10. `initCompatibilityGlobals`: 150 lines
11. `collectDistrictBuildingDetailOutput`: 134 lines
12. `completeSpyMission`: 129 lines
13. `openGenericDistrictBuildingDetail`: 119 lines
14. `bindFactionRegistration`: 110 lines
15. `bindPlayerProfilePopup`: 107 lines
16. `syncStartPhaseResourceSimulation`: 107 lines
17. `bindBuildingActionStatus`: 106 lines
18. `drawAttackDistrictAnimation`: 104 lines
19. `drawPoliceDistrictAnimation`: 103 lines
20. `drawReducedMapActivityIcon`: 101 lines
21. `getDistrictEconomySnapshot`: 96 lines
22. `bindSettingsModal`: 95 lines
23. `completeRobberyOrder`: 88 lines
24. `bindCityStatusBar`: 85 lines
25. `createProductionCard`: 82 lines
26. `bindRegisteredPlayerState`: 79 lines
27. `syncDevOnlyPolicePressure`: 78 lines
28. `syncFactoryProduction`: 71 lines
29. `runDistrictBuildingActionFromContext`: 70 lines
30. `upgradeDistrictBuildingDetail`: 70 lines

## Public Window API

Existing compatibility surfaces preserved:

- `window.EmpireRuntime`
- `window.EmpireRuntimeModules`
- `window.bootstrapPage`
- `window.initRuntime`
- `window.refreshAllUi`
- `window.handleActionResult`
- `window.showToast`
- `window.showNotification`
- `window.showSuccess`
- `window.showError`
- `window.showWarning`
- `window.showInfo`
- `window.clearNotifications`
- `window.empireStreetsPage`
- `window.empireStreetsDistrictState`
- `window.empireStreetsAllianceState`
- `window.empireStreetsBountyState`
- `window.Empire`
- `window.EmpireGameplaySliceClient`
- `window.EmpireAdminSliceDemo`

No new inline HTML handlers were introduced. The user-listed direct globals like `openMarket` and `startAttack` were not found as existing classic globals in the canonical runtime; existing module/runtime APIs were preserved instead of inventing new public names.

## Runtime Category Map

A) boot/init: `initRuntime`, `bootstrapPage`, `bindUiEvents` remain in runtime.
B) global state: timers, queues, weak maps and mission maps remain in runtime.
C) public handler registration: centralized in `runtime/compatibility.js`.
D) refresh pipeline: runtime `refreshAllUi` remains narrow; map refresh pipeline exists separately.
E) action result handling: new `runtime/actionResultOrchestrator.js` normalizes partial results and is used by `handleActionResult`.
F) map renderer: main renderer remains in runtime.
G) map shell/overlay UI: already modularized in `map/`.
H) selected district UI: summary/action hub modules exist; selected-state mutation remains in runtime.
I) district action hub: UI module exists.
J) building detail: UI and view-model modules exist; mechanics and mutation stay in runtime.
K) production/recipe UI: UI modules exist; read-only production info payload moved in this sprint.
L) market UI: panel/view-model/stock/action/popup adapters exist; state mutation stays in runtime.
M) attack/spy UI: UI modules exist; combat math and timers stay in runtime.
N) robbery/heist UI: high-risk state flow remains in runtime.
O) trap/defense UI: high-risk state flow remains in runtime.
P) battle report UI: panel module exists.
Q) heat/wanted/police UI: wanted and police result modules exist; police pressure logic remains in runtime.
R) event feed/drby UI: event feed module exists; feed state side effects stay in runtime.
S) profile/resources/storage UI: panel modules exist.
T) demo/dev UI: demo scenarios are external; free-session checklist added in this sprint.
U) localStorage/persistence: `persistence/legacyStorage.js` owns safe JSON/storage wrappers.
V) helpers/constants/labels: many constants and formatters already extracted.
W) server/API sync: not moved.
X) true gameplay logic: not moved.

## Moved In This Sprint

- Market popup sellable item and catalog panel payload assembly moved to `page-assets/js/app/runtime/marketPopupViewModel.js`.
- Production building info rows, recipe info lines and factory info rows moved to `page-assets/js/app/runtime/productionInfoViewModel.js`.
- Action result normalization and typed UI result helpers moved to `page-assets/js/app/runtime/actionResultOrchestrator.js`.
- Free-session readiness evaluation moved to `page-assets/js/app/dev/freeSessionChecklist.js`.

## Safe Bugfixes / Guards

- `marketPopupViewModel` now handles `tabConfig: null` without throwing.
- Action results with null/partial payload now normalize to safe `{ payload: {}, snapshot: {}, options: { refresh: true } }`.
- Free-session readiness handles missing DOM, missing player, missing district APIs and demo-active state without throwing.
- Production/factory info view models handle missing config/rates without throwing.

## High-Risk Areas Left Untouched

- `bindDistrictCanvas`: click/hover, selected district mutation, map redraw, ownership and action bridge are tightly coupled.
- `renderDistrictCanvas`: map geometry, visibility and ownership drawing.
- `applyDistrictBuildingSpecialAction`: rewards, cooldowns, heat and storage mutation.
- `completeAttackOrder`, `completeSpyMission`, `completeRobberyOrder`: outcome application and timers.
- Market price refresh and persistence: `refreshMarketPricesIfNeeded`, stock normalization, inventory/economy/heat writes.
- Production craft/collect state mutation and cooldown scheduling.
- Police pressure/raid calculations and world-state writes.

## Free Session

Status: partial.

Automated smoke and unit checks pass, and the new readiness checker can classify ready/partial/blocked states from mock state/DOM/API inputs. Full browser end-to-end verification is still required before calling MVP free flow ready.

Known free-session risks:

- Large map interaction block is still legacy/high-risk.
- Attack/spy/robbery flows still rely on timers and runtime-local state.
- Market and production UI are better modularized, but actual mutation flows are still runtime-coupled.
- Browser-level repeated-click and reload/save-load coverage remains manual.

## Verification

Passed:

- `node --check page-assets/js/app/runtime.js`
- `node --check page-assets/js/app/runtime/marketPopupViewModel.js`
- `node --check page-assets/js/app/runtime/productionInfoViewModel.js`
- `node --check page-assets/js/app/runtime/actionResultOrchestrator.js`
- `node --check page-assets/js/app/dev/freeSessionChecklist.js`
- Targeted unit tests for market, production info, action result, free session readiness and runtime smoke/refactor guards.
- `npm run typecheck`
- `npm run lint:architecture`
- `npm run lint:file-sizes`
- `npm run smoke:ui`
- `npm run test:unit`

Full unit result: 65 files, 262 tests passed.

## Manual Checklist

1. Login/lobby/game boot.
2. Enter free mode.
3. Verify map renders.
4. Hover district tooltip.
5. Click owned district.
6. Click enemy district.
7. Verify selected district summary.
8. Verify district action hub.
9. Open building detail.
10. Collect production.
11. Craft recipe.
12. Verify resources refresh.
13. Verify storage refresh.
14. Open market and buy/sell.
15. Create/cancel/buy player-market listing.
16. Open spy panel.
17. Resolve or inspect spy result.
18. Open attack panel.
19. Verify battle report.
20. Open robbery panel if available.
21. Verify trap/defense panel if available.
22. Verify heat/wanted UI.
23. Verify police feedback/modal/feed.
24. Verify event feed/drby.
25. Verify profile popup.
26. Verify overlay toggles.
27. Verify demo mode is inactive unless selected.
28. Reload and verify save/load state.
29. Verify console has no fatal errors.

## Next Step

Safest next refactor: extract read-only wanted/police status view-model assembly from `bindGangWantedStatus` into `runtime/policeViewModel.js`, leaving gang heat mutation, police pressure timers, raid calculations and storage writes in runtime.

## 10 Percent Safe Reduction Follow-up

Date: 2026-05-05

- Canonical runtime: `page-assets/js/app/runtime.js`
- Generated publish copy: `client/page-assets/js/app/runtime.js`
- Rule followed: `client/` was not edited by hand; regenerate it through the page build before publishing.
- Runtime before follow-up: 14,260 lines
- Runtime after follow-up: 12,790 lines
- Removed from runtime: 1,470 lines
- Reduction: 10.31%
- New modules: `map/mapCanvasAnimations.js`, `map/districtCanvasRenderer.js`, `ui/runtimePopupBinders.js`
- New tests: `runtime-map-canvas-modules.test.js`, `runtime-popup-binders.test.js`

Moved code is UI/render shell only: district canvas animation sprites/badges, pure district canvas paint pass, settings/profile/alliance/storage/logout/spy-resource binders. Gameplay mutations, rewards, cooldowns, production output, ownership, battle outcomes and market pricing stayed in runtime/core.

Verification:

- `npm run typecheck`: passed
- `npm run lint:architecture`: passed
- `npm run lint:file-sizes`: passed
- `npm run smoke:ui`: passed
- `npm run test:unit`: passed, 67 files / 266 tests
