# Runtime Remaining Size Map

Date: 2026-05-05

## Canonical Runtime

- Canonical source: `page-assets/js/app/runtime.js`
- Current size: 16,152 lines after market UI and attack/spy UI extraction
- Generated publish copy: `client/page-assets/js/app/runtime.js`, 19,274 lines
- Source rule: `client/` is generated output from `scripts/build-netlify-client.mjs`; do not edit it manually.

## Broad Section Map

| Range | Lines | Section | Type | Notes |
| --- | ---: | --- | --- | --- |
| 1-713 | 713 | Imports, runtime constants, settings/orchestrator helper start | mixed | Mostly wiring and imported extracted modules. |
| 714-1485 | 772 | Registration, market state, inventories, economy, topbar money | mixed | Contains state read/write plus UI refresh. |
| 1486-2467 | 982 | Police action state, district gossip, heat tiers, penalties | gameplay/mixed | Police/heat mutation and debug-only pressure. |
| 2468-3999 | 1,532 | Mission result modals, street-news feed wiring, attack/occupy/robbery/spy orders | gameplay/mixed | High-risk state mutation and result UI. |
| 4000-5451 | 1,452 | Production/crafting, factory/pharmacy boost helpers and production UI | mixed | Craft state plus large render helpers. |
| 5452-5993 | 542 | Market popup orchestration | mixed | Rendering now delegates to `ui/marketPanel.js`; transactions stay in runtime. |
| 5995-6790 | 796 | Page context, launch players, district ownership/resources/economy snapshots | mixed | State adapters and economy projections. |
| 6791-9317 | 2,527 | District building detail, building mechanics, collect/actions/detail popups | mixed/gameplay | Biggest non-map building block. |
| 9318-10654 | 1,337 | Spy resource UI, spy completion, map fill helpers and canvas overlay drawing helpers | map/mixed | Many pure drawing helpers plus spy state mutation. |
| 10655-14300 | 3,646 | Canvas map renderer and `bindDistrictCanvas` action hub | map/gameplay/mixed | Largest remaining block; still tightly coupled. |
| 14302-15780 | 1,479 | UI binders: map phase, building feed, settings, auth, wanted, profile, alliance, special buildings | mixed/UI | Several medium extract candidates. |
| 15781-16152 | 372 | Storage/spy resource/city status/orchestrator/export facade | orchestrator/mixed | Should stay as runtime facade for now. |

## Top 20 Largest Blocks

| # | Block | Range | Lines | What It Does | Type | Risk | Recommended Action |
| ---: | --- | --- | ---: | --- | --- | --- | --- |
| 1 | `bindDistrictCanvas` | 10903-14300 | 3,398 | Owns map DOM binding, interaction overlay, hover canvas, tooltip, selected district popup, buildings popup, attack/spy/robbery/defense/trap/occupy action wiring, animation loop, district API bridge. | map/gameplay/mixed | high | leave for now; split only after browser/click guards. |
| 2 | `bindMarketPopup` | 5452-5993 | 542 | Owns market popup state, tabs, server scope, price refresh, transaction callbacks and feedback decisions. DOM rendering now delegates to `ui/marketPanel.js`. | mixed | medium | split view-model preparation later; keep transaction logic in runtime. |
| 3 | `applyDistrictBuildingSpecialAction` | 8109-8564 | 456 | Executes building special actions: costs, cooldowns, boosts, heat, drby/event output and state mutation. | gameplay | high | leave; needs per-building action tests before moving. |
| 4 | `openGenericDistrictBuildingDetail` | 8873-9316 | 444 | Opens generic building detail popup, resolves profile/mechanics, renders header/body/actions and wires detail buttons. | mixed/UI | medium | split; extract popup rendering and keep collect/action callbacks in runtime. |
| 5 | `bindFactoryPopup` | 15307-15612 | 306 | Binds factory popup, dashboard, tabs, collect/upgrade and boost actions. | mixed/UI | high | split after production UI fixtures. |
| 6 | `resolveDistrictBuildingDetailMechanics` | 7596-7881 | 286 | Builds building detail mechanic view models for casino, exchange, arcade, apartments, school, warehouse, clinic, autosalon, fitness, smuggling tunnel and default buildings. | helper/mixed | medium | split pure view model helpers; keep state readers in runtime wrapper. |
| 7 | `bindGangWantedStatus` | 14787-15048 | 262 | Binds wanted popup, heat status, tier UI, protection, heat actions and clear log. | mixed/UI | medium | split wanted panel rendering; keep heat mutations in runtime. |
| 8 | `renderDistrictCanvas` | 10655-10901 | 247 | Draws full canvas map: background, fills, selected highlight, borders, ownership badges and active overlays. | map | high | needs browser screenshot/canvas guards before extraction. |
| 9 | `createProductionCard` | 4412-4651 | 240 | Builds production recipe cards for pharmacy/druglab/armory, quantity controls, start/collect buttons, timers and inventory labels. | mixed/UI | medium-high | split pure card renderer only after production UI tests. |
| 10 | `renderMarketTab` | 5707-5939 | 233 | Builds normal/black market view models and delegates item DOM to `ui/marketPanel.js`. | mixed | low-medium | optional later split into pure view-model builder. |
| 11 | Map popup `openPopup` | 12909-13115 | 207 | Nested inside map binder; renders selected district popup content and action availability. | map/mixed | high | leave until district selection/popup callbacks are isolated. |
| 12 | `ensureDistrictBuildingDetailPopup` | 8677-8871 | 195 | Creates or reuses generic building detail popup DOM and close/backdrop behavior. | UI-only-ish | medium | extract modal shell helper after popup tests. |
| 13 | `bindProductionBuildingPopup` | 4674-4867 | 194 | Binds production building popup, tabs, upgrade/collect and render loop. | mixed | high | split after production panel extraction. |
| 14 | `renderFactoryDashboard` | 15352-15543 | 192 | Renders factory dashboard, supplies, slots, collect/upgrade/boost state. | UI/mixed | medium | extract factory dashboard renderer with callbacks. |
| 15 | `renderDistrictBuildingInfoSection` | 7425-7594 | 170 | Renders building detail info, stats, mechanic rows and action descriptions. | UI/mixed | medium | extract to building detail panel module. |
| 16 | `completeAttackOrder` | 3380-3539 | 160 | Resolves attack order, mutates gang/world/defense/traps, records intel, opens result and dispatches bounty event. | gameplay | high | leave; only move after attack completion regression suite. |
| 17 | `ensureMissionAnimationLoop` | 13324-13469 | 146 | Nested map animation loop for active missions, police/traps/orders and redraw scheduling. | map/gameplay | high | leave until map view model separates active markers. |
| 18 | `renderPlayerMarketTab` | 5563-5705 | 143 | Builds player market view models and delegates listing/sell-form DOM to `ui/marketPanel.js`. | mixed | low-medium | optional later split into pure view-model builder. |
| 19 | `collectDistrictBuildingDetailOutput` | 7903-8036 | 134 | Collects local building output into player state, handles school/tunnel/clinic/warehouse side effects and feedback. | gameplay | high | leave; needs collect regression tests. |
| 20 | `completeSpyMission` | 9375-9503 | 129 | Resolves spy outcome, mutates spy intel/resources, records intel, opens result/warning modal. | gameplay | high | leave; needs spy completion regression tests. |

## Market UI Extraction Status

Completed on 2026-05-05:

- Added `page-assets/js/app/ui/marketPanel.js` with market dashboard rendering, normal/black market rows, player listing UI, feedback rendering, and popup open/close helpers.
- Reduced `page-assets/js/app/runtime.js` from 16,441 to 16,164 lines in this step.
- Reduced `bindMarketPopup` from about 831 lines to 542 lines.
- Runtime still owns market price refresh, active tab state, server scope, buy/sell/listing/cancel transactions, stock mutation, player inventory/cash mutation, heat risk, and player feedback decisions.
- `client/page-assets/js/app/runtime.js` was not edited because `client/` is generated publish output.

## Attack/Spy UI Extraction Status

Completed on 2026-05-05:

- Added `page-assets/js/app/ui/attackPanel.js` for attack setup popup rendering, attack confirm popup rendering, attack progress/status UI, and open/close guards.
- Added `page-assets/js/app/ui/spyPanel.js` for spy confirm popup rendering, spy warning modal rendering, simple spy result rendering, and open/close guards.
- Reduced `page-assets/js/app/runtime.js` from 16,164 to 16,152 lines in this step. The line reduction is intentionally small because the remaining attack/spy code in `bindDistrictCanvas` prepares view models and owns gameplay wiring.
- Runtime still owns attack loadout reads, `calculateAttackDeployment`, `validateAttackSelection`, `resolveAttackOutcome`, attack order creation, weapon/gang mutation, cooldown scheduling, spy state mutation, spy mission scheduling, intel mutation, heat/result payload decisions, map redraw, and district ownership changes.
- `client/page-assets/js/app/runtime.js` was not edited because `client/` is generated publish output.

## Best Next Safe Extractions

These are ordered by line reduction potential and safety. Estimated reductions are approximate because runtime must keep thin wrappers and public exports.

| Priority | Candidate | Likely Lines Removed | Why It Is Safe Enough | Guard Needed |
| ---: | --- | ---: | --- | --- |
| 1 | District building detail UI to `ui/buildingDetailPanel.js` | 550-850 | `renderDistrictBuildingInfoSection`, modal shell, and much of `openGenericDistrictBuildingDetail` can become render-only. Runtime keeps collect/action/state mutation. | Tests for building with no actions, collect action, special action, missing DOM. |
| 2 | Production UI widgets to `ui/productionPanel.js` | 450-700 | Metric blocks, supply rows, factory info, production cards and render panel are mostly DOM construction. Runtime keeps jobs/inventory/craft handlers. | Tests for pharmacy/druglab/armory cards, active job, ready job, insufficient inventory. |
| 3 | Map overlay drawing helpers to `map/mapOverlayRenderer.js` | 500-850 | Recent guards now cover canvas styles for selection/ownership; pure draw helpers can accept `context`, `district`, `marker`, `tick`. | Add canvas-call tests for spy/police/attack/robbery/trap/reduced markers before moving. |
| 4 | Wanted/heat popup rendering to `ui/wantedPanel.js` | 220-350 | Heat tier display and wanted modal rendering can be separated from `addGangHeat`/spend actions. | Tests for each tier, protection label, clear-log button callback. |
| 5 | Market view-model builder split from `bindMarketPopup` | 120-220 | Market DOM is already extracted; remaining low-risk work is pure view-model preparation for tabs/listings. | Tests must compare normal, black market and player listing payloads before moving. |

## Blocks To Leave For Now

- `bindDistrictCanvas` as a whole: too much map, popup and gameplay action coupling.
- `completeAttackOrder`, `completeSpyMission`, `completeRobberyOrder`, `completeOccupyOrder`: state mutation and ownership changes.
- Attack/spy calculation and mission scheduling inside `bindDistrictCanvas`: UI rendering has moved, but gameplay state mutation must stay until command-style tests cover start/resolve flows.
- `applyDistrictBuildingSpecialAction`, `collectDistrictBuildingDetailOutput`, `upgradeDistrictBuildingDetail`: building economy/cooldown/storage side effects.
- Market transaction execution inside `bindMarketPopup`: economy, stock, listing, cash, storage and heat mutation should stay until command-style tests exist. Market DOM rendering has already moved.
- Police/heat mutation functions: keep until police MVP tick/server integration is covered.

## Recommended Next Prompt

> Proveď bezpečný refaktor district building detail UI z `runtime.js`: vytvoř `page-assets/js/app/ui/buildingDetailPanel.js`, přesuň pouze DOM renderování detail popupu, info rows, mechanic cards a action button layout, runtime nech řešit collect, upgrade, special action efekty, cooldowny a state mutation přes callbacky. Neměň gameplay hodnoty, texty ani public window API. Přidej testy pro budovu bez akcí, collect-only budovu, special-action budovu, missing DOM a zavření popupu.
