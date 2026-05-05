# Runtime Orchestrator Hardening

Date: 2026-05-05

## 10 Percent Reduction Update

Runtime now delegates additional UI/render shell code:

- `map/mapCanvasAnimations.js` owns canvas-only district activity animations and badge rendering helpers.
- `map/districtCanvasRenderer.js` owns the pure district canvas paint pass while runtime preserves the public `renderDistrictCanvas` export.
- `ui/runtimePopupBinders.js` owns settings/profile/alliance/storage/logout/spy-resource shell binders.

Runtime size moved from 14,260 to 12,790 lines in this follow-up, a 10.31% reduction. Public exports remain in place through runtime destructuring/delegation.

## Status

This sprint hardened runtime orchestration without changing gameplay calculations.

## Completed

- `runtime/compatibility.js` now exposes:
  - `registerRuntimePublicHandlers`
  - `unregisterRuntimePublicHandlers`
  - `getRegisteredPublicHandlers`
  - `assertPublicHandlersExist`
  - `createSafePublicHandler`
  - `initRuntimeCompatibilityGlobals`
- Public handlers are registered through safe wrappers that warn and return a fallback instead of throwing when a handler is unavailable or fails.
- Police action result rendering is delegated to `ui/policeActionResultPanel.js`.
- Factory dashboard rendering is delegated to `ui/factoryPanel.js`.
- Factory dashboard label/view-model assembly is delegated to `runtime/factoryViewModel.js`.
- Market player listing, catalog buy and catalog sell callback orchestration is delegated to `runtime/marketActionOrchestrator.js`.
- Market transaction helper and player listing total helper are delegated to `runtime/marketActionOrchestrator.js`.
- Market stock labels, stock percent values, dashboard stock summary and heat-risk table lookup are delegated to `runtime/marketStockViewModel.js`.
- Market popup player-listing and catalog panel payloads are delegated to `runtime/marketPopupViewModel.js`.
- Production/factory info text payloads are delegated to `runtime/productionInfoViewModel.js`.
- Public `handleActionResult` normalizes partial results through `runtime/actionResultOrchestrator.js`.
- Free-session readiness diagnostics are available in `dev/freeSessionChecklist.js`.

## Still In Runtime

- `bindDistrictCanvas`: high-risk map interaction shell, selected district mutation, action bridge and modal refresh order.
- `bindMarketPopup`: still owns DOM shell binding, active tab, price refresh scheduling and mutation dependency wiring.
- `applyDistrictBuildingSpecialAction`: building rewards, cooldowns, heat and storage mutation.
- `completeAttackOrder`, `completeSpyMission`, `completeRobberyOrder`: outcome application and timers.
- Main result modal queue and timer ownership.

## Safety Boundary

Runtime should continue to own state mutation until there are command-level integration tests around each action. UI modules should receive already prepared view models and callbacks.

## Next Safe Step

Extract read-only wanted/police status view-model assembly from `bindGangWantedStatus` next. Keep gang heat mutation, police pressure timers, raid calculations and storage writes in runtime.
