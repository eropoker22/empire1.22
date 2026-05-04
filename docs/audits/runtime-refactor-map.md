# Runtime Refactor Map

Audit date: 2026-05-04

Scope: `runtime.js` in the legacy static game page. This audit maps contents and refactor risk only. It does not change gameplay behavior, balance, public HTML-facing function names, or demo state semantics.

## Canonical Source And Copies

`scripts/build-netlify-client.mjs` defines `client/` as generated publish output. The script deletes `client/`, then copies canonical root `pages/`, `page-assets/`, `img/`, and explicit legacy compatibility modules into the publish directory.

| File | Lines | Role | Hash match | Notes |
|---|---:|---|---|---|
| `page-assets/js/app/runtime.js` | 18,284 | canonical source | matches `client` | Runtime facade after the first constants extraction. Edit this file only when runtime changes are needed. |
| `page-assets/js/app/runtime/constants.js` | 364 | canonical source | matches `client` | Data-only selector/path constants extracted from runtime. |
| `client/page-assets/js/app/runtime.js` | 18,284 | generated publish output | matches root | Do not edit manually; regenerate through `npm run build:admin:page` or `node scripts/build-netlify-client.mjs`. |
| `client/page-assets/js/app/runtime/constants.js` | 364 | generated publish output | matches root | Copied from canonical root source by the publish build. |
| `node_modules/vite/dist/node/runtime.js` | 1,067 | third-party dependency | unrelated | Not part of Empire Streets runtime. Ignore for project refactors. |

Duplicate risk:

- If `client/page-assets/js/app/runtime.js` is edited by hand, the next publish build will overwrite it.
- If root and `client` diverge, production can serve stale behavior while source reviews inspect a different file.
- Refactor PRs should update root source, then regenerate publish output only via build scripts when publish artifacts are intentionally included.

## A) Runtime Inventory

Line ranges are approximate and based on the canonical root file.

| Block | Approx. lines | What it does | Main globals/state | DOM/API surface | Type | Refactor risk |
|---|---:|---|---|---|---|---|
| Imports and compatibility boundary | 1-397 | Imports legacy-page configs/rules, authority-state session helpers, map navigation, leaderboard, police modal helpers, storage result payloads, and extracted runtime constants. | Imported configs, `getAuthoritySession`, `updateStoredPreviewSession`, constants from `runtime/constants.js`. | None directly. | mixed | medium |
| DOM selectors and constants module | `runtime/constants.js` 1-364 | Central data-only registry of selectors, image paths, modal selectors, map image paths, and overflow tooltip selectors. | Exported selector/path constants. | All `[data-*]`, modal ids, topbar selectors. | UI-only/data | low |
| Global runtime state | 398-953 | WeakMaps, timers, pending modal queue, police/market timers, heat tables, quote libraries, settings keys. | `buildingActionPanels`, mission timers, `pendingResultModalQueue`, `topbarStatSwitchTimer`, `startPhaseResourceSimulationState`. | Timer APIs, no direct DOM except later consumers. | mixed | medium |
| Settings and preview session wrappers | 935-1609 | Reads/writes settings, registration, inventories, economy, market state through `authority-state`; normalizes player market and dynamic prices. | `SETTINGS_STORAGE_KEY`, `getAuthoritySession`, `updateStoredPreviewSession`, market state. | `document.documentElement.dataset`, `empire:*` events. | mixed | medium |
| Topbar money/resources | 1615-1799 | Formats and animates topbar money/influence values; binds skip controls. | money animation timers, economy state. | topbar money/influence selectors, button events. | UI-only with state reads | low |
| World, police markers, district gossip | 1808-2505 | Resolves world state, active police markers, dev-only destroyed district, passive district gossip/drby, intel event text. | world state, police action markers, `DISTRICT_GOSSIP_SEED_LIBRARY`. | `empire:world-state-changed`, `empire:police-state-changed`. | mixed | high |
| Phase and gang heat/wanted | 2506-2980 | Syncs map/game phase, gang state, heat tiers, heat decay, wanted level, local police pressure, inventory penalties for raids. | gang state, heat journal, police timers, heat tier constants. | wanted popup consumers, gang state events. | gameplay logic | high |
| Mission persistence and result modal helpers | 2983-3732 | Stores attack/occupy/robbery/spy orders; builds spy/raid/attack/police modal payloads; result modal queue. | mission order state, `pendingResultModalQueue`, `policeActionResultLiveTimerId`. | spy/raid/attack/police modal selectors. | mixed | medium |
| Building action feed and notifications | 3733-4125 | Normalizes building action feed entries, renders feed rows, captures mutation observer changes, sets feedback text. | `buildingActionPanels`, action log snapshots. | building action feed/status selectors, MutationObserver. | UI-only/mixed | low-medium |
| Attack, occupy, robbery preview order resolution | 4138-4528 | Completes and schedules browser-local attack, occupy, and robbery orders; mutates district ownership and gang resources. | attack/occupy/robbery orders, world state, weapon inventory. | result modals, `window.empireStreetsDistrictState`, bounty events. | gameplay logic | high |
| Spy state and missions | 4534-4637 and 11142-11408 | Stores spy missions/intel, resolves completed spy outcomes, renders spy resource state. | spy state, spy intel, mission timers. | spy resource topbar, spy result/warning modals. | gameplay logic | high |
| Inventory and production core preview | 4641-6267 | Browser-local inventory outputs, production jobs, pharmacy/drug lab/factory/armory production cards, boosts, recipes, factory supplies. | production state, factory state, material/drug/weapon inventories, production timers. | production popups, recipe cards, resource pills. | mixed | high |
| Market | 6268-7099 | Renders normal/black/player market tabs, stock, dynamic prices, player listings, buy/sell flows, dirty heat side effects. | market state, economy, material/drug/weapon inventories, gang heat. | market popup tabs/list/dashboard/feedback. | mixed | medium-high |
| Page context and pure utilities | 7100-7154 | Collects mount metadata, creates page context, seeded random, clamp/hash helpers. | none beyond root DOM. | mount selectors. | helpers/utils | low |
| Map seed data and district catalog | 7155-8378 | Creates district type grid, start owner map, player color/name/avatar maps, district building packages, building variant names, district economy snapshots. | `DISTRICT_TYPE_GRID`, `START_PHASE_OWNER_BY_DISTRICT_ID`, catalog cache. | none directly; feeds map/popup rendering. | demo/gameplay data | high |
| Start-phase resource simulation | 8378-8779 | Calculates displayed income/heat/influence and start-phase resource simulation. | economy/gang/world state, start-phase simulation state. | topbar displays. | demo gameplay logic | high |
| Building detail data/profiles | 8780-9136 | Building popup targets, detail profiles, special action profiles, mechanics type map, detail context WeakMap. | static profile/action data, `districtBuildingDetailContextByShell`. | building detail popup consumers. | mixed data | medium |
| Building detail mechanics and actions | 9138-11088 | Calculates network multipliers, stored output, upgrades, special actions, district building detail popup UI, collect/upgrade/action dispatch. | district detail localStorage, clinic pool localStorage, economy/gang/inventory state. | dynamic popup shell, detail tabs, action buttons. | mixed gameplay/UI | high |
| District atmosphere and adjacency helpers | 11089-11141 | Maps district types to image/mood metadata and adjacency lookups. | `DISTRICT_ATMOSPHERE_META`. | district popup atmosphere image/labels. | UI data/helpers | low |
| Canvas map rendering and animations | 11484-12882 | Map fill styles, image loading, Voronoi-like district geometry, polygon math, spy/police/attack/robbery/trap/occupy animations, alliance/bounty badges. | map geometry, active marker sets. | canvas context, map image assets. | UI rendering with gameplay markers | high |
| District canvas binding and district selection | 12883-16414 | Wires canvas, tooltip, district popup, buildings popup, action buttons, map settings, district state API, capture/destroy/ownership changes. | `interactionState`, `window.empireStreetsDistrictState`, world/mission states. | map canvas, district popup, action popups, building chips, global window API. | mixed | high |
| Map/phase/settings binders | 16415-16712 | Binds map phase, border color, game phase, building action status, settings modal, logout. | settings state, world state. | phase buttons, settings modal, logout buttons. | UI-only/mixed | medium |
| Formatting and auth/registration | 16713-17166 | Currency/list helpers, faction preview, auth status, registration submit flow, initial faction/economy/gang state. | registration, economy, inventory, gang defaults. | auth form, faction cards, status mount. | mixed | medium |
| Wanted/player profile/alliance popups | 16904-17431 | Wanted status popup and heat reduction buttons; player profile popup; alliance popup. | gang heat, economy, registration, alliance provider. | wanted modal, player popup, alliance popup. | mixed | medium |
| Production/storage popup binders | 17432-17850 | Binds armory/pharmacy/drug lab/factory/storage popups and keeps factory UI synced. | production/factory/storage states. | production and storage popup selectors. | UI-only with state writes | medium |
| Spy resource and city status | 17851-17974 | Topbar spy/influence toggle and city clock/status bar. | spy state, phase state, city timer. | city status/topbar selectors. | UI-only | low |
| Overflow tooltip helper | 17975-18070 | Shows tooltip for truncated text on hover/focus. | local tooltip state. | root tooltip element, pointer/focus/resize events. | UI-only | low |
| Bootstrap and exports | 18071-18284 | Calls all binders, sets `window.empireStreetsPage`, exports many helpers/constants used by tests and legacy UI modules. | page context. | `main[data-page]`, global `window.empireStreetsPage`. | public runtime surface | high |

Public surface warning:

- The export block at lines 18117-18284 is used by tests and other legacy modules.
- `bootstrapPage`, `bind*`, `getStored*`, `setStored*`, map helpers, production helpers, and toast functions should not be renamed during extraction.
- Extraction should preserve re-export names from `runtime.js` until callers are migrated.

## B) Duplicate Logic Already Covered Elsewhere

| Runtime area | Newer equivalent | What to migrate eventually | What must stay for legacy UI now |
|---|---|---|---|
| District/building catalog and fixed building package selection, lines 7155-8378 and 8780-9136 | `packages/game-config/src/public/building-definitions.ts`, `building-name-variants.ts`, `district-building-sets.ts`, `base-fixed-buildings-config.ts` | Static building catalog, names, sets, and free-mode fixed building selection should be sourced from config/projections. | Legacy map needs localized labels, variant names, and package previews until static page consumes server projections. |
| Building detail action validation and effects, lines 9138-11088 | `packages/game-core/src/handlers/useBuildingAction.ts`, `validateRunBuildingAction.ts`, building-specific handlers, `packages/shared-types/src/views/district-panel-view.ts` | Server-authoritative action execution, cooldowns, costs, heat, reports. | Popup rendering and old action buttons must remain until the client reads `DistrictPanelBuildingActionView`. |
| Production/crafting preview, lines 4641-6267 and 17432-17850 | `packages/game-core/src/handlers/collectProduction.ts`, `craftItem.ts`, production rules, `packages/game-config/src/public/free-mode-*.ts`, `apps/client/src/features/building-panel/*` | Queue/complete/collect/craft processing, storage caps, recipe state, input validation. | Production popups and local demo state for pharmacy, drug lab, factory, armory. |
| Market state and dirty heat side effects, lines 6268-7099 | `packages/game-core/src/rules/market/serverMarketSystem.ts`, client transport in `apps/client/src/transport/*` | Server market listings, stock, transactions, dirty-payment heat consequences. | Legacy popup and demo player market until server-fed market UI exists. |
| Attack/spy/trap/conflict flows, lines 4138-4637 and 14476-16328 | `packages/game-core/src/handlers/attackDistrict.ts`, `spyDistrict.ts`, `rules/traps`, validators, `apps/client/src/features/district-panel/*` | Command validation, resolution, ownership mutation, cooldowns, conflict reports. | Canvas popup controls, local timers, and visual mission markers. |
| Police heat/wanted/raid preview, lines 2506-2980 and 3250-3732 | `packages/game-core/src/handlers/playerPoliceState.ts`, `rules/police/triggerRaid.ts`, `evaluatePolicePressure.ts`, report projections | Wanted thresholds, raid trigger/consequences, player police state updates. | Wanted popup, local heat journal, police modal UI, dev-only preview pressure. |
| Report/modal payloads, lines 3147-3732 and 3733-4125 | `packages/game-core/src/projections/conflict-report-projection.ts`, `packages/shared-types/src/views/report-view.ts` | Normalize all battle/spy/building action reports into shared view types. | Modal rendering and action feed display until UI consumes shared report views. |
| Player profile, registration, and topbar data, lines 16731-17401 | `packages/shared-types/src/views/player-view.ts`, `apps/client/src/ui/top-bar`, server player projections | Server-fed player snapshot, profile data, notifications. | Legacy registration lock, local player popup, faction preview. |
| Persistence and session state wrappers, lines 935-1609, 1808-1839, 2536-2699 | `apps/server/src/runtime/persistence/*`, snapshot orchestrators, `apps/server/src/runtime/projections/*` | Save/load should become server runtime persistence, not browser-local authority. | `authority-state.js` preview session remains the bridge for static demo. |
| Map/district projection, lines 12639-16414 | `packages/game-core/src/projections/district-summary-projection.ts`, `district-panel-projection.ts`, `apps/server/src/runtime/projections/*` | Ownership/status/heat/building state should come from projections. | Canvas geometry/rendering and popup interactions until the new client owns the map. |
| Client/server transport | `apps/client/src/transport/fetch-client-transport.ts`, `apps/server/src/transport/gameplay-slice-json-handler.ts` | Runtime should submit commands through transport instead of mutating preview session. | Current static runtime has no direct `fetch`; it mutates local preview state through `authority-state.js`. |

## C) Safe Extraction Candidates

Prefer extracting data and pure UI helpers first, while keeping `runtime.js` as a compatibility re-export facade.

1. DOM selector/constants module
   - Candidate file: `page-assets/js/app/runtime/selectors.js` or `runtime/constants.js`.
   - Status: completed as `page-assets/js/app/runtime/constants.js` for data-only selector/path constants.
   - Risk: low.

2. Formatters and pure helpers
   - Move `formatCurrency`, `formatDurationLabel` re-export wrapper, `clamp`, `createSeededRandom`, color helpers, timestamp labels.
   - Keep exported names re-exported from `runtime.js`.
   - Risk: low.

3. Overflow tooltip helper
   - Move `bindOverflowTextTooltips` and `OVERFLOW_TEXT_TOOLTIP_SELECTOR`.
   - It is self-contained and UI-only.
   - Risk: low.

4. Result modal row rendering
   - Move `renderActionResultRows`, modal open/close helpers, and payload-to-DOM utilities.
   - Do not move conflict resolution or police rules.
   - Risk: low-medium because selectors are broad.

5. Toast system
   - Move `showSpyToast`, `showAttackToast`, `showRobberyToast` and their timer ids behind a small module.
   - Preserve exported function names.
   - Risk: low-medium.

6. Player profile popup
   - Move `bindPlayerProfilePopup` plus profile-specific selectors after adding a smoke test for opening/closing the popup.
   - Risk: low-medium.

7. Storage popup rendering
   - Move `bindStoragePopup` and inventory count rendering.
   - Keep inventory read/write functions in `runtime.js` for the first pass.
   - Risk: low-medium.

8. Static district/building display data
   - Move variant name arrays and `DISTRICT_BUILDING_DETAIL_PROFILES` into a data-only module.
   - Do not change source data or mechanics calculations.
   - Risk: medium due to large data surface and legacy labels.

9. Production display components
   - Move pure card/metric builders such as `createMetricBlock`, `createProductionCard`, `renderProductionPanel`.
   - Keep state mutation and recipe execution in place.
   - Risk: medium.

10. Market pure normalizers
   - Move `normalizeMarketServerId`, stock/listing normalizers, price formatting helpers.
   - Keep buy/sell actions and heat mutation in runtime until tests cover them.
   - Risk: medium.

## D) High-Risk Areas To Avoid Without Tests

- Attack flow: `completeAttackOrder`, `scheduleAttackOrder`, `applyAttackAction`, attack setup/confirm popups, capture/destroy side effects.
- District ownership and district state API: `window.empireStreetsDistrictState`, `captureDistrict`, `destroyDistrict`, selected district state.
- Map rendering and geometry: district polygon generation, hit testing, canvas draw order, mission animations.
- Save/load persistence: `authority-state` writes, `updateStoredPreviewSession`, localStorage keys for building details and clinic recovery pool.
- Server sync and transport migration: any replacement of local preview mutation with `apps/client` transport.
- Building actions and building detail mechanics: action costs, cooldowns, heat, storage, upgrade, population, clinic/recycling effects.
- Police heat integration: heat decay, wanted popup, dirty/clean heat reduction, auto police pressure, raid/police result payloads.
- Production/crafting mutation: inventory consumption, storage caps, recipe timers, factory/pharmacy boosts.
- Market transactions: stock mutation, player listings, dirty heat side effects.
- Spy/occupy/robbery mission timers: local timers and result payloads are tightly coupled to map markers and popups.

## E) Recommended Refactor Order

### PR 1: Extract Runtime Constants And Selectors

- Goal: move data-only selectors/constants into `page-assets/js/app/runtime/constants.js`.
- Files: `page-assets/js/app/runtime.js`, new constants module.
- Risk: low.
- Status: completed on 2026-05-04. `runtime.js` keeps the compatibility facade and imports the extracted constants.
- Verify: `npm run smoke:ui`, `npm run typecheck`, `npm run lint:architecture`, `npm run lint:file-sizes`, `npm run test`, and a text search that `runtime.js` still re-exports public names.

### PR 2: Extract Pure Formatters And Utility Helpers

- Goal: move pure helpers with no DOM/state writes (`clamp`, color helpers, seeded random, currency/timestamp labels).
- Files: `page-assets/js/app/runtime.js`, new `runtime/formatters.js` or `runtime/utils.js`.
- Risk: low.
- Verify: `npm run smoke:ui`, existing unit tests that import exported helpers, and a quick import check from legacy modules.

### PR 3: Extract Overflow Tooltip And Toast UI

- Goal: isolate self-contained UI-only behavior (`bindOverflowTextTooltips`, spy/attack/robbery toast rendering).
- Files: `page-assets/js/app/runtime.js`, new `runtime/overflow-tooltips.js`, `runtime/toasts.js`.
- Risk: low-medium.
- Verify: `npm run smoke:ui`; manual browser check on hover/focus tooltip and mission toast display if touching toast code.

### PR 4: Extract Result Modal Renderers

- Goal: move modal DOM rendering helpers while leaving payload creation and gameplay resolution in runtime.
- Files: `page-assets/js/app/runtime.js`, new `runtime/result-modals.js`.
- Risk: medium.
- Verify: `npm run smoke:ui`, targeted tests for attack/spy/building action flows, and manual open/close check for spy, attack, raid, and police modals.

### PR 5: Extract Static Building Display Data

- Goal: move variant name arrays, detail profiles, and display-only metadata into a data module.
- Files: `page-assets/js/app/runtime.js`, new `runtime/building-display-data.js`.
- Risk: medium.
- Verify: `npm run smoke:ui`, `npm run test -- tests/integration/game-core/building-action-flow.test.ts` or equivalent targeted command, and a visual check of representative building detail panels.

### PR 6: Extract Storage Popup Rendering

- Goal: move storage popup count rendering and DOM binding, but keep inventory state mutation in runtime.
- Files: `page-assets/js/app/runtime.js`, new `runtime/storage-popup.js`.
- Risk: medium.
- Verify: `npm run smoke:ui`, storage popup manual check, production/craft targeted tests, and no change to inventory getter/setter exports.

Stop after PR 6. The next phase should add tests before extracting building actions, map rendering, attack/spy/robbery, police heat, market transactions, or persistence.

## Operational Rules For Refactor PRs

- Edit only `page-assets/js/app/runtime.js` and new canonical modules under `page-assets/js/app/`.
- Do not edit `client/page-assets/js/app/runtime.js` by hand.
- Keep `runtime.js` as the compatibility facade and preserve current export names.
- After each accepted source refactor, regenerate publish output through `npm run build:admin:page` if `client/` artifacts are part of the change.
- Do not move gameplay mutation into UI modules; server-authoritative replacements belong in `packages/game-core`, `packages/game-config`, `apps/server`, and `apps/client` transport/projection code.
