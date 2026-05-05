# Runtime Large Extraction Audit

Date: 2026-05-05

## Canonical Source

- Canonical runtime source: `page-assets/js/app/runtime.js`
- Generated publish copy: `client/page-assets/js/app/runtime.js`
- Publish rule: `scripts/build-netlify-client.mjs` clears and rebuilds `client/` from root `pages/`, `page-assets/`, `img/`, and explicit compatibility package copies.
- Manual edit rule: do not edit `client/` by hand. Regenerate it through the publish/build script.

`pages/game.html` loads `../page-assets/js/app.js` as `type="module"`. `page-assets/js/app.js` imports `bootstrapPage` through `page-assets/js/app/render-ui.js`, and `render-ui.js` imports runtime exports from `page-assets/js/app/runtime.js`. The runtime path is therefore ESM, not a classic inline script.

## Line Count

| File | Before large extraction | After large extraction | After market UI extraction | Total Delta |
| --- | ---: | ---: | ---: | ---: |
| `page-assets/js/app/runtime.js` | 17,721 | 16,441 | 16,152 | -1,569 |
| `client/page-assets/js/app/runtime.js` | 19,274 | 19,274 | 19,274 | 0, generated output not edited |

The reduction is intentionally below the requested ideal 25-40% because the remaining large blocks are gameplay-coupled. Further extraction should happen behind narrower tests instead of moving attack, ownership, tick, market transaction, police, or server-sync behavior by bulk.

Market UI follow-up on 2026-05-05 moved DOM rendering out of `bindMarketPopup` while keeping prices, inflation, stock, listings, cash/storage mutation and heat logic in runtime.

Attack/spy UI follow-up on 2026-05-05 moved setup/confirm popup rendering and spy warning modal DOM rendering out of `bindDistrictCanvas`/runtime while keeping attack math, spy math, resource costs, cooldowns, heat, mission scheduling and ownership mutation in runtime.

## Extracted Blocks

| Module | Lines | Contents | Why Low Risk |
| --- | ---: | --- | --- |
| `page-assets/js/app/runtime/narrativeData.js` | 432 | Police raid metadata, police/spy quote libraries, district gossip seed catalog. | Static data only; runtime imports same identifiers. |
| `page-assets/js/app/runtime/districtBuildingData.js` | 226 | District minute income rules, building income/heat/influence rules, package pools, downtown fixed packages, tier label formatter. | Config and pure label helper only; no state mutation. |
| `page-assets/js/app/runtime/buildingDetailData.js` | 438 | Building popup targets, building detail profiles, special action profiles, building mechanic constants/configs. | Static UI/config data; selector dependencies imported from existing constants. |
| `page-assets/js/app/runtime/marketData.js` | 37 | Legacy market limits, stock defaults, player market item catalog, default server id. | Constants only; no transaction logic moved. |
| `page-assets/js/app/runtime/combatData.js` | 15 | Attack/defense item labels and ids, spy capture cooldown constant. | Constants only; no combat math moved. |
| `page-assets/js/app/runtime/heatData.js` | 75 | Gang heat costs, tier table, decay and auto-police interval constants. | Constants only; heat mutation and police decisions remain in runtime. |
| `page-assets/js/app/runtime/productionBuildingData.js` | 59 | Production building UI config, production resource labels, production slot visuals. | UI/config data only; craft state and production actions remain in runtime. |
| `page-assets/js/app/runtime/compatibility.js` | 52 | `window.EmpireRuntime`, `window.EmpireRuntimeModules`, and legacy global aliases. | Thin facade over existing runtime API; no boot or gameplay work. |
| `page-assets/js/app/ui/eventFeedPanel.js` | 181 | Street-news snapshot normalization, fingerprints, timestamps, and feed item DOM rendering. | Rendering/formatting only; decisions that create feed entries remain in runtime. |
| `page-assets/js/app/ui/marketPanel.js` | 496 | Market dashboard rendering, normal and black market item rows, player listing/sell-form UI, feedback rendering, popup open/close helpers. | DOM rendering only; runtime still owns pricing, buy/sell/listing/cancel transactions, stock, cash/storage mutation and heat. |
| `page-assets/js/app/ui/attackPanel.js` | 195 | Attack setup popup rendering, attack confirm popup rendering, attack status/progress rendering, open/close guards. | UI only; runtime still owns loadout reads, validation, attack order creation, costs, cooldowns and result scheduling. |
| `page-assets/js/app/ui/spyPanel.js` | 193 | Spy confirm popup rendering, spy warning modal rendering, simple spy result rendering, open/close guards. | UI only; runtime still owns spy availability, mission creation, intel mutation, cooldowns and result payload decisions. |

## Compatibility Layer

Runtime now initializes a safe compatibility facade:

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

The compatibility layer is safe in non-browser tests because it no-ops when no `window` exists. Repeated init keeps event listener protection in `runtimeUiBoundRoots` / `runtimeInitializedRoots`.

## Existing Public Runtime Exports To Preserve

The runtime export surface still includes the existing boot, binding, rendering, state, and gameplay call sites used by `render-ui.js`, feature facade files, debug modules, and tests:

- Boot/orchestration: `bootstrapPage`, `initRuntime`, `bindUiEvents`, `hydrateInitialState`, `refreshAllUi`, `handleActionResult`
- UI bindings: `bindFactionRegistration`, `bindDistrictCanvas`, `bindBuildingActionStatus`, `bindPlayerProfilePopup`, `bindMarketPopup`, `bindStoragePopup`, `bindCityStatusBar`
- Runtime UI calls: `showToast`, `showSuccess`, `showError`, `showWarning`, `showSpyToast`, `showAttackToast`, `showRobberyToast`
- Gameplay wiring: `completeAttackOrder`, `scheduleAttackOrder`, `completeRobberyOrder`, `scheduleRobberyOrder`, `completeSpyMission`, `scheduleSpyMission`
- Map/game state helpers: `renderDistrictCanvas`, `getDistrictFillStyle`, `getCurrentPlayerOwnedDistrictIds`, `getDistrictOwnerLabel`

## Still In Runtime

These blocks remain intentionally in `runtime.js`:

- Boot and state orchestration.
- Local authority/session reads and writes that still coordinate legacy UI.
- Attack, robbery, spy, occupy, trap, district ownership, and result mutation flow.
- Attack/spy start flow state mutation remains in runtime; only setup/confirm/warning UI rendering delegates to `ui/attackPanel.js` and `ui/spyPanel.js`.
- Map renderer, map interactions, zoom/pan, canvas drawing, selected district handling.
- Building action effects, production tick, collect logic, cooldown logic.
- Market buy/sell, listing/cancel, stock, dynamic price and heat logic. Market DOM rendering now delegates to `ui/marketPanel.js`.
- Police/heat state mutation and automatic police action scheduling.
- Server-authoritative sync boundary and runtime facades consumed by other modules.

## Not Extracted Yet

| Block | Reason | Needed Before Extraction |
| --- | --- | --- |
| Map renderer | Tightly coupled to canvas, ownership, overlays, selection and animation state. | Screenshot/browser guard and map renderer module tests. |
| Attack/spy/robbery completion | Mutates gang state, world state, heat/intel, result modals, map ownership. Setup/confirm UI rendering is already extracted. | Dedicated integration tests for each completion result. |
| Building actions and production collect | Updates economy/storage/cooldowns and triggers result feed. | Per-building action regression tests and payload fixtures. |
| Market transaction logic | Touches economy, listings, dynamic prices, stock, heat and transaction history. Market UI rendering is already extracted. | Market command tests around each runtime call site. |
| Police heat mutation | Runtime still owns legacy heat journal and modal feedback. | Police MVP integration tests through tick/server runtime. |
| Local storage/session write paths | Already wrapped in persistence helpers, but still used by many flows. | Migration tests for old saves and mode/server key separation. |

## Manual Test Checklist

Run the game and verify:

1. Login/lobby still reaches the game screen.
2. Game boot removes `game-body--booting`.
3. Topbar clean money, dirty money, influence, spies and gang values render.
4. Player profile opens, closes, and refreshes values.
5. Map renders districts; clicking a district selects it.
6. Owned and captured districts still use player color fill.
7. District detail panel renders owner, zone, heat, influence and buildings.
8. Building popup opens for normal and special buildings.
9. Buildings with no special actions do not show a special-action row.
10. Toasts and street-news feed entries render and clickable result details open.
11. Spy, robbery and attack setup modals still open.
12. Attack result/battle report modal still renders.
13. Local save/load survives page reload.
14. Demo/debug scenario flow is only entered explicitly.

## Verification

Passed:

- `npm run typecheck`
- `npm run smoke:ui`
- `npm run lint:architecture`
- `npm run lint:file-sizes`
- `npm run test`

Additional targeted guards passed during the extraction:

- `tests/unit/runtime-refactor-guard.test.js`
- `tests/unit/runtime-main-flow-smoke.test.js`
- `tests/unit/runtime-orchestrator.test.js`
- `tests/unit/runtime-map-rendering.test.js`
- `tests/unit/runtime-notifications.test.js`
- `tests/unit/runtime-event-feed-panel.test.js`
- `tests/unit/runtime-compatibility.test.js`
- `tests/unit/runtime-attack-spy-panel.test.js`

## Risks

- `runtime.js` is still large and still owns gameplay-coupled behavior.
- Line reduction is limited by safety; moving more lines now would require moving state mutation logic.
- `client/` remains stale until the publish build regenerates it.
- Browser-level visual QA is still needed for map/canvas and responsive popups after large frontend edits.

## Recommended Next Refactor Step

Next safest prompt:

> Proveď bezpečný refaktor district building detail UI z `runtime.js`: vytvoř `page-assets/js/app/ui/buildingDetailPanel.js`, přesuň pouze DOM renderování detail popupu, info rows, mechanic cards a action button layout, runtime nech řešit collect, upgrade, special action efekty, cooldowny a state mutation přes callbacky. Neměň gameplay hodnoty, texty ani public window API. Přidej testy pro budovu bez akcí, collect-only budovu, special-action budovu, missing DOM a zavření popupu.

This continues with a large UI-only block before touching the riskier map renderer.
