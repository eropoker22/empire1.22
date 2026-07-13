# Runtime Refactor Map

Audit date: 2026-05-04
Last updated: 2026-05-05, helper, demo scenario, notification, overflow tooltip, resources/storage rendering, battle report rendering, shared result modal helper, district panel, building panel rendering, building action UI registry/result panel extraction, legacy localStorage persistence boundary, first runtime orchestrator pass, player profile panel rendering extraction, map constants/data adapter/geometry extraction, and static building variant display-data extraction.

Scope: `runtime.js` in the legacy static game page. This audit maps contents and refactor risk only. It does not change gameplay behavior, balance, public HTML-facing function names, or demo state semantics.

## Canonical Source And Copies

`scripts/build-netlify-client.mjs` defines `client/` as generated publish output. The script deletes `client/`, then copies canonical root `pages/`, `page-assets/`, `img/`, and explicit legacy compatibility modules into the publish directory.

| File | Lines | Role | Hash match | Notes |
|---|---:|---|---|---|
| `page-assets/js/app/runtime.js` | 16,110 | canonical source | source of truth | Runtime facade after constants, formatter, small utility, demo scenario registry, toast notification rendering, overflow tooltip binding, resource/storage UI rendering, battle report rendering, shared result modal helper extraction, district/building panel UI rendering extraction, building action UI registry/result panel extraction, legacy localStorage boundary extraction, first orchestrator wrapper pass, player profile panel rendering extraction, map constants/data/geometry extraction, and building variant display-data extraction. Edit this file only when runtime changes are needed. |
| `page-assets/js/app/runtime/constants.js` | 361 | canonical source | source of truth | Data-only selector/path constants extracted from runtime. |
| `page-assets/js/app/runtime/formatters.js` | 58 | canonical source | source of truth | Pure legacy formatter helpers extracted from runtime. |
| `page-assets/js/app/runtime/utils.js` | 63 | canonical source | source of truth | Pure numeric/color/URL helpers extracted from runtime. |
| `page-assets/js/app/runtime/buildingDisplayData.js` | 430 | canonical source | source of truth | Static building variant display names extracted from runtime. It does not contain building mechanics, action effects, income rules, cooldowns, or balance. |
| `page-assets/js/app/dev/demoScenarios.js` | 121 | canonical source | source of truth | Static dev/demo launch scenario, demo market sellers, and demo-mode guard helper. |
| `page-assets/js/app/ui/notifications.js` | 249 | canonical source | source of truth | UI-only toast/notification rendering helpers. Existing runtime call sites remain in `runtime.js`. |
| `page-assets/js/app/ui/overflowTextTooltips.js` | 97 | canonical source | source of truth | UI-only clipped-text tooltip binder. Runtime still calls it during boot; selector data stays in `runtime/constants.js`. |
| `page-assets/js/app/ui/resourcesPanel.js` | 386 | canonical source | source of truth | UI-only topbar resource, gang member, and storage counter rendering helpers. Runtime still owns state reads, production, collect, craft, and market mutation. |
| `page-assets/js/app/ui/battleReportPanel.js` | 136 | canonical source | source of truth | UI-only attack/battle report modal renderer with a missing-container guard. Runtime still owns attack calculation, losses, ownership, heat, cooldowns, and report payload creation. |
| `page-assets/js/app/ui/resultModalPanel.js` | 93 | canonical source | source of truth | UI-only shared modal row escaping/rendering and simple result modal renderer used by spy and raid results. Runtime still owns result queues, payload creation, police live timers, and gameplay decisions. |
| `page-assets/js/app/ui/districtPanel.js` | 229 | canonical source | source of truth | UI-only selected district summary, metrics, flag, building chip list, and district action row rendering. Runtime still owns selected state, ownership, hidden/destroyed checks, action availability, and callbacks. |
| `page-assets/js/app/ui/buildingPanel.js` | 214 | canonical source | source of truth | UI-only buildings popup tabs/detail rendering, building stat/mechanic row DOM helpers, and building action row rendering. Runtime still owns building data, action effects, cooldown calculations, collect/upgrade logic, and event delegation. |
| `page-assets/js/app/ui/buildingActionUiRegistry.js` | 256 | canonical source | source of truth | UI-only building action labels, icon labels, badges, fallback labels, disabled reason text selection, action descriptions, action output profile summaries, and category labels. Runtime still owns action availability checks, cooldowns, costs, effects, resource mutation, income, heat, and production. |
| `page-assets/js/app/ui/buildingActionResultPanel.js` | 155 | canonical source | source of truth | UI-only building action result payload cloning, success/fail normalization, and optional result panel rendering with a missing-container guard. Runtime still owns result routing, feed state, modal queues, gameplay payload creation, and refresh orchestration. |
| `page-assets/js/app/ui/playerProfilePanel.js` | 93 | canonical source | source of truth | UI-only player profile popup field, avatar background, and profile button accent renderer. Runtime still owns registration/economy/gang/alliance state reads and popup open/close listeners. |
| `page-assets/js/app/persistence/legacyStorage.js` | 241 | canonical source | source of truth | Browser-local legacy storage boundary for preview session, settings, demo state, building detail state, clinic recovery pool, and legacy avatar text reads. It preserves existing keys by default and adds safe parse/fallback helpers for scoped future free/war/server keys. |
| `page-assets/js/app/map/mapConstants.js` | 147 | canonical source | source of truth | Map-only constants, zone colors, labels, fallback values, and map CSS class names. |
| `page-assets/js/app/map/mapDataAdapter.js` | 150 | canonical source | source of truth | Pure map owner/zone/building-list normalization and district view model helpers. |
| `page-assets/js/app/map/mapGeometry.js` | 325 | canonical source | source of truth | Pure district grid, launch owner map, Voronoi-like geometry generation, remap helpers, adjacency, and hit testing. Renderer, overlays, ownership mutation, click binding, and zoom/pan remain in runtime. |
| `client/page-assets/js/app/runtime.js` | 19,274 | generated publish output | stale until regenerated | Do not edit manually; regenerate through `npm run build:admin:page` or `node scripts/build-netlify-client.mjs` when publish output should be refreshed. |
| `client/page-assets/js/app/runtime/constants.js` | 361 | generated publish output | copied by build | Copied from canonical root source by the publish build. |
| `node_modules/vite/dist/node/runtime.js` | 1,067 | third-party dependency | unrelated | Not part of Empire Streets runtime. Ignore for project refactors. |

Duplicate risk:

- If `client/page-assets/js/app/runtime.js` is edited by hand, the next publish build will overwrite it.
- If root and `client` diverge, production can serve stale behavior while source reviews inspect a different file.
- Refactor PRs should update root source, then regenerate publish output only via build scripts when publish artifacts are intentionally included.

## A) Runtime Inventory

Line ranges are approximate and based on the canonical root file.

| Block | Approx. lines | What it does | Main globals/state | DOM/API surface | Type | Refactor risk |
|---|---:|---|---|---|---|---|
| Imports and compatibility boundary | 1-457 | Imports legacy-page configs/rules, authority-state session helpers, legacy storage boundary helpers, map navigation, leaderboard, police modal helpers, storage result payloads, extracted runtime constants, formatters, utility helpers, notification UI helpers, overflow tooltip binder, resources panel render helpers, battle report renderer, shared result modal helpers, district panel renderers, building panel renderers, and player profile panel renderer. | Imported configs, `getAuthoritySession`, `updateStoredPreviewSession`, storage helpers from `persistence/legacyStorage.js`, constants from `runtime/constants.js`, helpers from `runtime/formatters.js`, `runtime/utils.js`, `ui/notifications.js`, `ui/overflowTextTooltips.js`, `ui/resourcesPanel.js`, `ui/battleReportPanel.js`, `ui/resultModalPanel.js`, `ui/districtPanel.js`, `ui/buildingPanel.js`, and `ui/playerProfilePanel.js`. | None directly. | mixed | medium |
| DOM selectors and constants module | `runtime/constants.js` 1-361 | Central data-only registry of selectors, image paths, modal selectors, map image paths, and overflow tooltip selectors. | Exported selector/path constants. | All `[data-*]`, modal ids, topbar selectors. | UI-only/data | low |
| Formatters module | `runtime/formatters.js` 1-58 | Formats legacy currency, district income/heat/influence labels, building money, and building cooldown labels. | none | None. | helpers/utils | low |
| Runtime utility module | `runtime/utils.js` 1-63 | Provides deterministic random, clamp, district cell hash, hex color helpers, and CSS URL formatting. | none | Uses `window.location.href` only inside `resolveRuntimeAssetUrl` when called. | helpers/utils | low |
| Demo scenario registry | `dev/demoScenarios.js` 1-121 | Holds dev-only launch scenario player names/colors/avatars, owner coordinates, demo market sellers, resource simulation values, and `isDemoScenarioMode`. | none | None. | demo-only data/helpers | low |
| Toast/notification UI module | `ui/notifications.js` 1-249 | Owns reusable dynamic notification rendering plus legacy spy/attack/robbery toast DOM toggling and timers. | internal WeakMap timers only | `[data-mount-role="notifications"]`, `[data-notification-root]`, `#game-toast-root`, existing toast selectors passed by runtime. | UI-only | low |
| Overflow tooltip UI module | `ui/overflowTextTooltips.js` 1-97 | Binds hover/focus clipped-text tooltips, tooltip positioning, touch-hover ignore, scroll hide, and resize repositioning. | local tooltip state | root tooltip element, pointer/focus/resize/scroll events. | UI-only | low |
| Resources/storage UI module | `ui/resourcesPanel.js` 1-386 | Renders topbar clean/dirty cash, influence/spy pill, gang member count, storage popup counters, and resource animation classes. | internal timer maps and last-rendered topbar values only | topbar resource selectors, `[data-gang-members]`, storage counter selectors. | UI-only | low |
| Battle report UI module | `ui/battleReportPanel.js` 1-136 | Renders attack result modal fields, tone classes, defense visibility, and missing-container warning. | none | attack result modal selectors. | UI-only | low |
| Result modal UI helper module | `ui/resultModalPanel.js` 1-93 | Escapes result modal row HTML, renders generic modal rows, applies tone classes, and opens simple result modals for spy/raid style payloads. | none | selectors passed by runtime. | UI-only | low |
| District panel UI module | `ui/districtPanel.js` 1-229 | Renders selected district title/type/owner/avatar background, defense/economy metric labels, district flags, visible building chips/trap chip, and district action rows. | none | elements passed by runtime; preserves existing `data-district-*` attributes. | UI-only | low-medium |
| Building panel UI module | `ui/buildingPanel.js` 1-214 | Renders the Buildings popup type buttons, base-building/variant grids, generic building stat/mechanic rows, and building action rows with disabled/cooldown labels. | none | elements passed by runtime; preserves existing `data-buildings-*` and `data-district-building-detail-*` attributes. | UI-only | low-medium |
| Player profile UI module | `ui/playerProfilePanel.js` 1-93 | Renders player popup avatar background, fallback letter, profile button accent, identity/faction/server/resource/gang/alliance/district labels. | none | elements passed by runtime; preserves existing `data-player-popup-*` attributes and CSS custom properties. | UI-only | low |
| Legacy storage boundary module | `persistence/legacyStorage.js` 1-241 | Provides safe JSON/text localStorage helpers, legacy session load/save/clear, scoped key generation for explicit free/war/server state, demo state load/save, settings, building detail, and clinic recovery pool helpers. | browser `localStorage`, legacy key names. | none directly. | persistence boundary | low-medium |
| Global runtime state and orchestrator guards | 408-982 | WeakMaps, timers, pending modal queue, police/market timers, heat tables, quote libraries, and idempotent runtime root guards. | `buildingActionPanels`, mission timers, `pendingResultModalQueue`, `startPhaseResourceSimulationState`, `runtimeInitializedRoots`, `runtimeUiBoundRoots`, `runtimeContextsByRoot`. | Timer APIs, no direct DOM except later consumers. | mixed | medium |
| Settings and preview session wrappers | 935-1609 plus `persistence/legacyStorage.js` | Runtime reads/writes settings through the storage boundary; registration, inventories, economy, market state still flow through `authority-state`, which normalizes state shape and delegates browser storage to `legacyStorage`. | `getAuthoritySession`, `updateStoredPreviewSession`, `loadSettingsState`, `saveSettingsState`, market state. | `document.documentElement.dataset`, `empire:*` events. | mixed | medium |
| Topbar money/resources | 1615-1666 and `ui/resourcesPanel.js` | Runtime obtains displayed resource snapshots and binds skip controls; UI module renders topbar money/influence/spy values and animations. | economy/gang/spy state in runtime; UI timer state in module. | topbar money/influence/spy selectors, button events. | UI-only with state reads | low |
| World, police markers, district gossip | 1808-2505 | Resolves world state, active police markers, dev-only destroyed district, passive district gossip/drby, intel event text. | world state, police action markers, `DISTRICT_GOSSIP_SEED_LIBRARY`. | `empire:world-state-changed`, `empire:police-state-changed`. | mixed | high |
| Phase and gang heat/wanted | 2506-2980 | Syncs map/game phase, gang state, heat tiers, heat decay, wanted level, local police pressure, inventory penalties for raids. | gang state, heat journal, police timers, heat tier constants. | wanted popup consumers, gang state events. | gameplay logic | high |
| Mission persistence and result modal helpers | 2983-3698 | Stores attack/occupy/robbery/spy orders; builds spy/raid/attack/police modal payloads; result modal queue. Attack result DOM rendering is delegated to `ui/battleReportPanel.js`; shared row rendering and simple spy/raid result modal rendering are delegated to `ui/resultModalPanel.js`. Spy warning, police, and city-event live renderers remain in runtime. | mission order state, `pendingResultModalQueue`, `policeActionResultLiveTimerId`. | spy/raid/attack/police modal selectors. | mixed | medium |
| Building action feed and street news | 3733-4125 | Normalizes building action feed entries, renders feed rows, captures mutation observer changes, sets feedback text. This is not a pure toast layer because entries carry result payloads and clickable modal state. | `buildingActionPanels`, action log snapshots. | building action feed/status selectors, MutationObserver. | UI-only/mixed | low-medium |
| Attack, occupy, robbery preview order resolution | 4138-4528 | Completes and schedules browser-local attack, occupy, and robbery orders; mutates district ownership and gang resources. | attack/occupy/robbery orders, world state, weapon inventory. | result modals, `window.empireStreetsDistrictState`, bounty events. | gameplay logic | high |
| Spy state and missions | 4534-4637 and 11142-11408 | Stores spy missions/intel, resolves completed spy outcomes, renders spy resource state. | spy state, spy intel, mission timers. | spy resource topbar, spy result/warning modals. | gameplay logic | high |
| Inventory and production core preview | 4641-6267 | Browser-local inventory outputs, production jobs, pharmacy/drug lab/factory/armory production cards, boosts, recipes, factory supplies. | production state, factory state, material/drug/weapon inventories, production timers. | production popups, recipe cards, resource pills. | mixed | high |
| Market | 6268-7099 | Renders normal/black/player market tabs, stock, dynamic prices, player listings, buy/sell flows, dirty heat side effects. Demo seller names now come from `dev/demoScenarios.js`. | market state, economy, material/drug/weapon inventories, gang heat. | market popup tabs/list/dashboard/feedback. | mixed | medium-high |
| Page context and pure utilities | 7100-7154 | Collects mount metadata, creates page context, seeded random, clamp/hash helpers. | none beyond root DOM. | mount selectors. | helpers/utils | low |
| Map seed data and district catalog | 7155-8378 and `map/mapGeometry.js` / `runtime/buildingDisplayData.js` | Runtime now imports district type grid, start owner map helpers, geometry helpers, and building variant names from data modules; district building packages and district economy snapshots remain in runtime. | `DISTRICT_TYPE_GRID`, `START_PHASE_OWNER_BY_DISTRICT_ID`, catalog cache, imports from `dev/demoScenarios.js`, `map/mapGeometry.js`, `runtime/buildingDisplayData.js`. | none directly; feeds map/popup rendering. | demo/gameplay data | medium-high |
| Start-phase resource simulation | 8378-8779 | Calculates displayed income/heat/influence and start-phase resource simulation. | economy/gang/world state, start-phase simulation state. | topbar displays. | demo gameplay logic | high |
| Building detail data/profiles | 8780-9136 | Building popup targets, detail profiles, special action profiles, mechanics type map, detail context WeakMap. | static profile/action data, `districtBuildingDetailContextByShell`. | building detail popup consumers. | mixed data | medium |
| Building detail mechanics and actions | 9138-11088 | Calculates network multipliers, stored output, upgrades, special actions, collect/upgrade/action dispatch, and prepares building panel view rows. Building stat/mechanic DOM helpers and action row rendering are delegated to `ui/buildingPanel.js`; action labels, descriptions, disabled reason display text, category labels, and output summaries are delegated to `ui/buildingActionUiRegistry.js`; district detail and clinic pool localStorage reads/writes are delegated to `persistence/legacyStorage.js`. | district detail state, clinic pool state, economy/gang/inventory state. | dynamic popup shell, detail tabs, action buttons. | mixed gameplay/UI | high |
| District atmosphere and adjacency helpers | 11089-11141 | Maps district types to image/mood metadata and adjacency lookups. | `DISTRICT_ATMOSPHERE_META`. | district popup atmosphere image/labels. | UI data/helpers | low |
| Canvas map rendering and animations | 11484-12882 plus `map/mapGeometry.js` | Map fill styles, image loading, polygon drawing, spy/police/attack/robbery/trap/occupy animations, alliance/bounty badges. Pure district geometry and hit testing are delegated to `map/mapGeometry.js`. | map geometry, active marker sets. | canvas context, map image assets. | UI rendering with gameplay markers | high |
| District canvas binding and district selection | 12883-16414 | Wires canvas, tooltip, district popup, buildings popup, action buttons, map settings, district state API, capture/destroy/ownership changes. Selected district summary/metrics/flags/building chips/action row DOM and Buildings popup DOM are delegated to `ui/districtPanel.js` and `ui/buildingPanel.js`. | `interactionState`, `window.empireStreetsDistrictState`, world/mission states. | map canvas, district popup, action popups, building chips, global window API. | mixed | high |
| Map/phase/settings binders | 16415-16712 | Binds map phase, border color, game phase, building action status, settings modal, logout. | settings state, world state. | phase buttons, settings modal, logout buttons. | UI-only/mixed | medium |
| Formatting and auth/registration | 16713-17166 | Currency/list helpers, faction preview, auth status, registration submit flow, initial faction/economy/gang state. | registration, economy, inventory, gang defaults. | auth form, faction cards, status mount. | mixed | medium |
| Wanted/player profile/alliance popups | 16904-17431 and `ui/playerProfilePanel.js` | Wanted status popup and heat reduction buttons; player profile popup state/listeners; alliance popup. Player profile field/avatar/accent DOM rendering is delegated to the UI module. | gang heat, economy, registration, alliance provider. | wanted modal, player popup, alliance popup. | mixed | medium |
| Production/storage popup binders | 17432-17850 | Binds armory/pharmacy/drug lab/factory/storage popups and keeps factory UI synced. Storage counter rendering is delegated to `ui/resourcesPanel.js`; production/craft state and factory dashboard rendering remain in runtime. | production/factory/storage states. | production and storage popup selectors. | UI-only with state writes | medium |
| Spy resource and city status | 17851-17974 | Topbar spy/influence toggle and city clock/status bar. | spy state, phase state, city timer. | city status/topbar selectors. | UI-only | low |
| Overflow tooltip binding | `ui/overflowTextTooltips.js` 1-97 | Shows tooltip for truncated text on hover/focus. Runtime only calls the binder during bootstrap. | local tooltip state inside module. | root tooltip element, pointer/focus/resize/scroll events. | UI-only | low |
| Runtime orchestrator, bootstrap, and exports | 18211-18547 | Adds `hydrateInitialState`, `refreshAllUi`, `handleActionResult`, `bindUiEvents`, and `initRuntime`. `bootstrapPage` is now a compatibility wrapper around `initRuntime`. Exports many helpers/constants used by tests and legacy UI modules. | page context, authority session snapshot, root init guards. | `main[data-page]`, global `window.empireStreetsPage`, `empire:runtime-refresh`. | public runtime surface/orchestration | high |

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
| Persistence and session state wrappers, lines 935-1609, 1808-1839, 2536-2699 plus `persistence/legacyStorage.js` | `apps/server/src/runtime/persistence/*`, snapshot orchestrators, `apps/server/src/runtime/projections/*` | Save/load should become server runtime persistence, not browser-local authority. | `legacyStorage.js` and `authority-state.js` remain the browser-local compatibility bridge for the static preview/demo flow. |
| Map/district projection, lines 12639-16414 | `packages/game-core/src/projections/district-summary-projection.ts`, `district-panel-projection.ts`, `apps/server/src/runtime/projections/*` | Ownership/status/heat/building state should come from projections. | Canvas geometry/rendering and popup interactions until the new client owns the map. |
| Client/server transport | `apps/client/src/transport/fetch-client-transport.ts`, `apps/server/src/transport/gameplay-slice-json-handler.ts` | Runtime should submit commands through transport instead of mutating preview session. | Current static runtime has no direct `fetch`; it mutates local preview state through `authority-state.js`. |

## Notification Extraction Boundary

Pure UI rendering moved to `page-assets/js/app/ui/notifications.js`:

- Existing static spy/attack/robbery toast show/hide behavior, including `is-visible` class toggling, `hidden` state, reflow trigger, and 1800 ms / 220 ms timers.
- Generic dynamic helpers: `showToast(message, type, options)`, `showSuccess`, `showError`, `showWarning`, and `clearNotifications`.
- The module returns safely when the notification container or static toast element is missing.

Gameplay and mixed decisions remain in `runtime.js`:

- Attack/robbery/spy flow still decides when to call `showAttackToast`, `showRobberyToast`, or `showSpyToast`.
- Building action street news (`setBuildingActionFeedback`, `appendBuildingActionResultEntry`, feed rows, clickable result payloads) stays in runtime because it is coupled to action result payloads and modal state.
- Market feedback stays inside `bindMarketPopup` because it is local to market transaction state.
- Wanted/police popup feedback stays inside `bindGangWantedStatus` because it is tied to heat spending and police state.

## Overflow Tooltip Boundary

Pure UI behavior moved to `page-assets/js/app/ui/overflowTextTooltips.js`:

- `bindOverflowTextTooltips(root)` owns the hover/focus listeners for clipped text, the generated `.overflow-text-tooltip` node, positioning, touch-hover ignore, scroll hide, and resize repositioning.
- `OVERFLOW_TEXT_TOOLTIP_SELECTOR` remains data-only in `page-assets/js/app/runtime/constants.js`.
- Runtime still calls `bindOverflowTextTooltips(root)` from `bootstrapPage` so the boot order and visible behavior stay unchanged.

No gameplay, state, balance, map ownership, persistence, police, attack, market, or building action logic moved in this pass.

## Resources And Storage Rendering Boundary

Pure UI rendering moved to `page-assets/js/app/ui/resourcesPanel.js`:

- `updateTopbarResources(playerState, options)` renders topbar clean cash, dirty cash, influence/spy pill text, titles, classes, and resource animations from an already prepared snapshot.
- `renderResourcesPanel(playerState, options)` renders small resource summary values such as gang members and delegates topbar values to `updateTopbarResources`.
- `renderStorageList(storageState, options)` renders weapon, material, drug, and factory supply counters in the storage popup.
- The module returns safely if root, topbar, spy, or storage counter elements are missing.

Gameplay, calculations, and state mutation remain in `runtime.js`:

- `getDisplayedResourceSnapshot`, start-phase passive resource simulation, district income math, heat gain, and influence math.
- `getResolvedWeaponInventory`, `getResolvedMaterialInventory`, `getResolvedDrugInventory`, `getStoredFactorySupplies`, and all storage state shape normalization.
- Production collect, craft, market buy/sell, factory dashboard logic, storage capacity rules, and localStorage/session persistence.
- Runtime keeps compatibility wrappers: `applyTopbarEconomy`, `renderGangMembersState`, `renderSpyResourceState`, and `bindStoragePopup`.

## Battle Report Rendering Boundary

Pure UI rendering moved to `page-assets/js/app/ui/battleReportPanel.js`:

- `renderBattleReport(root, payload, options)` renders the attack result modal, tone class, title, badge, summary, attack/defense values, attacker/defender losses, district state, duration, and hidden defense-power row.
- The renderer returns `false` and writes a console warning if the modal or required fields are missing, so runtime does not crash when the report container is absent.
- Runtime re-exports the renderer as `renderBattleReport` and keeps `openAttackResultModal` as the compatibility wrapper used by the existing result queue.

Gameplay, calculations, and state mutation remain in `runtime.js`:

- `completeAttackOrder`, `scheduleAttackOrder`, attack scenario resolution, member losses, defense reduction, trap handling, district ownership, destroyed district state, heat/police hooks, cooldown timing, bounty events, and street-news payload creation.
- Attack report payload creation remains in runtime for this pass because it is adjacent to combat state and uses already-computed attack outcome data.
- Spy warning, police, occupation aliases, and city-event modal renderers remain in runtime until they get their own targeted tests.

## Result Modal Helper Boundary

Pure UI helper rendering moved to `page-assets/js/app/ui/resultModalPanel.js`:

- `escapeModalHtml(value)` preserves the legacy escaping used by modal row HTML.
- `renderActionResultRows(container, rows)` renders the shared `<div class="modal__row">` detail rows used by spy, raid, and police result payloads.
- `renderSimpleResultModal(root, payload, config, options)` applies configured tone classes, title, optional badge, summary, detail rows, and opens a simple result modal. It returns `false` and logs a warning instead of throwing if required modal elements are missing.
- `openSpyResultModal` and `openRaidResultModal` in runtime are now thin compatibility wrappers around the UI helper.

Still in `runtime.js`:

- Result modal queueing, close handlers, pending queue state, and police live timer lifecycle.
- Spy/raid/attack/police payload creation and all state mutations.
- Spy warning identity/district formatting, because it has custom alert rows and classes.
- Police result rendering, because it syncs building action feed entries, supports live city-event rows, raid impact details, and auto-close logic.

## District And Building Panel Rendering Boundary

Pure DOM rendering moved to `page-assets/js/app/ui/districtPanel.js`:

- `renderDistrictSummaryPanel(elements, view)` renders selected district title, type/zone label, owner label, owner meta, avatar image/fallback, and owner background CSS variables from a prepared view model.
- `renderDistrictMetricSummary(elements, metrics)` writes already formatted defense, residents, income, heat, and influence labels.
- `renderDistrictFlags(flagsMount, flags)` renders the existing district flag chips.
- `renderDistrictBuildingList(elements, view)` renders building chips, empty/hidden/destroyed messages, and the trap chip while preserving `data-district-building-name`.
- `renderDistrictActionPanel(elements, view)` renders enabled/disabled district action rows and trap stacked button state while preserving `data-district-action-id`.

Pure DOM rendering moved to `page-assets/js/app/ui/buildingPanel.js`:

- `renderBuildingsPopupTypes(mount, view)` renders the Buildings popup type tabs.
- `renderBuildingsPopupDetail(mount, view)` renders the empty state, base-building buttons, and named building buttons while preserving `data-buildings-*` attributes.
- `createBuildingDetailStat` and `createBuildingDetailMechanicRow` create existing building detail stat/mechanic cells.
- `renderBuildingActionRows(mount, rows, options)` renders building action buttons with disabled state and cooldown text; runtime still uses existing event delegation, while tests can pass an optional callback.

Still in `runtime.js`:

- Selected district state, `interactionState`, ownership checks, hidden/destroyed visibility rules, known-defense checks, economy/heat/influence calculations, and all map rendering.
- District action availability from `resolveDistrictActions`, trap state, police lock state, and every action callback.
- Building catalog/profile resolution, building action availability, cooldown calculations, costs, active boosts, collect/upgrade/action side effects, production, storage, and persistence.
- Buildings popup source district filtering, selected base-name state, and building entry grouping/selection.

This pass does not make map rendering safe to refactor. Canvas geometry, hit testing, ownership fill, mission markers, and map animation remain high-risk until covered by browser or screenshot tests.

## Legacy Persistence Boundary

Browser-local persistence helpers moved to `page-assets/js/app/persistence/legacyStorage.js`:

- `loadState(mode, serverId)`, `saveState(mode, serverId, state)`, `clearState(mode, serverId)`, and `getStorageKey(mode, serverId)` wrap legacy player/session storage.
- The default unscoped path still uses `empireStreets.session.v1`, preserving existing saved static-preview sessions.
- Explicit scoped keys are available for future free/war/server separation, for example `empireStreets.session.free.free-eu-01.v1` and `empireStreets.session.war.war-eu-01.v1`; `loadState` falls back to the legacy key when scoped data is missing.
- `loadDemoState(id)` and `saveDemoState(id, state)` isolate demo/dev saved state from normal free/war session state.
- Settings, district building detail state, clinic recovery pool, and legacy avatar text reads now go through the storage boundary.
- Invalid JSON and storage access failures return a safe fallback and log a warning instead of throwing during runtime boot.

Still outside this pass:

- Session shape normalization stays in `page-assets/js/app/model/authority-state.js`.
- Gameplay state mutations still stay in runtime and existing feature modules.
- Server-authoritative persistence remains in `apps/server/src/runtime/persistence/*` and `apps/server/src/runtime/snapshots/*`; the legacy browser boundary is documented as static-preview compatibility, not the future authority.
- No saved data schema migration was introduced because this pass does not change payload shape.

## Runtime As Orchestrator

First safe orchestrator pass added the following runtime facade functions:

- `initRuntime(root)` is the idempotent boot entry. It hydrates initial state, creates the page context, binds UI events, applies settings, refreshes UI, marks the page ready, and stores the context per root.
- `hydrateInitialState(root)` reads the current browser-preview/server-authority snapshot through existing getters and returns a partial-safe runtime snapshot. It does not change gameplay values.
- `bindUiEvents(root, context)` wraps the existing binder calls and uses a root WeakSet guard so repeated init does not register the same UI listeners twice.
- `refreshAllUi(state)` is the central refresh pipeline for safe UI surfaces: topbar resources, gang/member resource display, spy/influence display, selected district panel refresh if a provider exists, and `empire:runtime-refresh` for already-bound popup/profile listeners.
- `handleActionResult(root, result)` is the new action-result entry point for future call sites. Existing `appendBuildingActionResultEntry` now also refreshes through the central pipeline unless callers pass `refresh: false`.

Guard behavior:

- Missing root returns `null` from `initRuntime`.
- Missing DOM anchors stay safe because existing binders keep their local guards; `bindFactoryPopup` also now avoids reading from a missing popup container.
- Repeated `initRuntime(root)` returns the existing context and only calls `refreshAllUi`; it does not call the binder list again.
- Partial state in `refreshAllUi` is tolerated; individual refresh sections catch and warn instead of failing boot.

Still in `runtime.js` after this pass:

- All gameplay action implementations, action costs/effects, cooldown calculations, attack/spy/robbery/occupy flow, map rendering, police heat, production, market, and server-authority bridge calls.
- Player profile state assembly and listeners remain in runtime, but field/avatar/accent DOM rendering is delegated to `ui/playerProfilePanel.js` and the popup listens to `empire:runtime-refresh`.
- Selected district panel rendering is still driven by the existing district canvas closure; the orchestrator only calls the exposed `refreshSelectedDistrictPanel` provider when available.

This pass does not make map rendering, attack flow, server sync, police heat, or building action mutation safe to refactor.

## C) Safe Extraction Candidates

Prefer extracting data and pure UI helpers first, while keeping `runtime.js` as a compatibility re-export facade.

1. DOM selector/constants module
   - Candidate file: `page-assets/js/app/runtime/selectors.js` or `runtime/constants.js`.
   - Status: completed as `page-assets/js/app/runtime/constants.js` for data-only selector/path constants.
   - Risk: low.

2. Formatters and pure helpers
   - Move `formatCurrency`, `formatDurationLabel` re-export wrapper, `clamp`, `createSeededRandom`, color helpers, timestamp labels.
   - Keep exported names re-exported from `runtime.js`.
   - Status: completed for `formatCurrency`, district/building formatters, `clamp`, `createSeededRandom`, `hashCell`, runtime hex helpers, and CSS URL formatting. `formatDurationLabel` still stays imported from `packages/game-core`.
   - Risk: low.

3. Demo scenario registry
   - Status: completed as `page-assets/js/app/dev/demoScenarios.js`.
   - Moved `MARKET_PLAYER_DEMO_SELLERS`, dev-only police/destroyed-district constants, start-phase owner coordinates, player colors/names, launch faction/avatar data, and start-phase resource simulation constants.
   - Added `isDemoScenarioMode` so demo behavior stays gated to `gamePhase === "launch"` and normal free/live flow does not activate it accidentally.
   - Risk: low.

4. Overflow tooltip helper
   - Move `bindOverflowTextTooltips` and `OVERFLOW_TEXT_TOOLTIP_SELECTOR`.
   - It is self-contained and UI-only.
   - Status: completed for binder behavior as `page-assets/js/app/ui/overflowTextTooltips.js`; selector data remains in `runtime/constants.js`.
   - Risk: low.

5. Result modal row rendering
   - Move `renderActionResultRows`, modal open/close helpers, and payload-to-DOM utilities.
   - Do not move conflict resolution or police rules.
   - Status: partially completed for attack/battle report modal rendering as `page-assets/js/app/ui/battleReportPanel.js`, plus shared row escaping/rendering and simple spy/raid result modals as `page-assets/js/app/ui/resultModalPanel.js`. Queueing, close handlers, spy warning, police, and city-event renderers remain in runtime.
   - Risk: low-medium because selectors are broad.

6. Toast system
   - Move `showSpyToast`, `showAttackToast`, `showRobberyToast` and their timer ids behind a small module.
   - Preserve exported function names.
   - Status: completed for pure UI rendering as `page-assets/js/app/ui/notifications.js`. Runtime now keeps `showSpyToast`, `showAttackToast`, and `showRobberyToast` as compatibility wrappers that call the UI module.
   - Left in runtime: gameplay decisions that call the toasts after spy/attack/robbery actions, plus mixed building action feed/status logic.
   - Risk: low-medium.

7. Resources/topbar rendering
   - Move topbar clean/dirty cash rendering, influence/spy pill rendering, gang member count rendering, and small resource animation helpers.
   - Historical note: this step originally kept passive production simulation in runtime. Passive production for Pharmacy, Drug Lab and Factory has since been removed; current production uses the canonical production-line model.
   - Status: completed as `page-assets/js/app/ui/resourcesPanel.js`.
   - Risk: low-medium.

8. Player profile popup
   - Move profile field/avatar/accent DOM rendering after adding focused renderer tests.
   - Status: completed as `page-assets/js/app/ui/playerProfilePanel.js`; `bindPlayerProfilePopup`, state reads, and open/close listeners remain in runtime.
   - Risk: low-medium.

9. District and building panel renderers
   - Move selected district summary/metrics/flags/building chips/action row rendering plus Buildings popup tabs/detail grids.
   - Keep selected state, ownership, action availability, map rendering, building action effects, cooldown calculations, and callbacks in runtime.
   - Status: completed as `page-assets/js/app/ui/districtPanel.js` and `page-assets/js/app/ui/buildingPanel.js`.
   - Risk: low-medium.

10. Storage popup rendering
   - Move `bindStoragePopup` and inventory count rendering.
   - Keep inventory read/write functions in `runtime.js` for the first pass.
   - Status: completed for inventory count rendering as `page-assets/js/app/ui/resourcesPanel.js`; popup open/close binding remains in runtime.
   - Risk: low-medium.

11. Legacy persistence boundary
   - Move direct browser storage access for settings, preview session, demo state, building detail state, and clinic recovery pool into a small persistence module.
   - Keep state shape normalization in `authority-state.js` and gameplay mutations in runtime.
   - Status: completed as `page-assets/js/app/persistence/legacyStorage.js`.
   - Risk: low-medium for the wrapper, high for any future schema migration.

12. Runtime orchestrator wrapper
   - Introduce `initRuntime`, `hydrateInitialState`, `bindUiEvents`, `refreshAllUi`, and `handleActionResult` without moving gameplay actions.
   - Keep `bootstrapPage` as the compatibility entry point.
   - Status: completed as a first safe pass in `runtime.js`.
   - Risk: medium because it touches boot order and public exports.

13. Static district/building display data
   - Move variant name arrays and `DISTRICT_BUILDING_DETAIL_PROFILES` into a data-only module.
   - Do not change source data or mechanics calculations.
   - Risk: medium due to large data surface and legacy labels.

14. Production display components
   - Move pure card/metric builders such as `createMetricBlock`, `createProductionCard`, `renderProductionPanel`.
   - Keep state mutation and recipe execution in place.
   - Risk: medium.

15. Market pure normalizers
   - Move `normalizeMarketServerId`, stock/listing normalizers, price formatting helpers.
   - Keep buy/sell actions and heat mutation in runtime until tests cover them.
   - Risk: medium.

## D) High-Risk Areas To Avoid Without Tests

- Attack flow: `completeAttackOrder`, `scheduleAttackOrder`, `applyAttackAction`, attack setup/confirm popups, capture/destroy side effects.
- District ownership and district state API: `window.empireStreetsDistrictState`, `captureDistrict`, `destroyDistrict`, selected district state.
- Map rendering: canvas draw order, ownership fill, mission animations, overlays, zoom/pan, hover and click selection. Pure geometry/hit testing is now in `map/mapGeometry.js`.
- Save/load authority migration: browser-local storage is now behind `legacyStorage.js`, but changing saved payload shape, replacing `authority-state`, or merging it with server snapshots remains high-risk without migration tests.
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
- Files: `page-assets/js/app/runtime.js`, `page-assets/js/app/runtime/formatters.js`, `page-assets/js/app/runtime/utils.js`, `tests/unit/runtime-formatters.test.js`, `tests/unit/runtime-utils.test.js`.
- Risk: low.
- Status: completed on 2026-05-04. `runtime.js` imports the helpers and keeps the existing public export names for `clamp`, `createSeededRandom`, `hashCell`, and `formatCurrency`.
- Verify: `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\unit\runtime-formatters.test.js tests\unit\runtime-utils.test.js`, `npm run smoke:ui`, `npm run typecheck`, `npm run lint:architecture`, `npm run lint:file-sizes`.

### PR 2b: Extract Demo Scenario Registry

- Goal: move dev/demo-only scenario data out of `runtime.js` while preserving launch scenario behavior.
- Files: `page-assets/js/app/runtime.js`, `page-assets/js/app/dev/demoScenarios.js`, `tests/unit/runtime-demo-scenarios.test.js`.
- Risk: low.
- Status: completed on 2026-05-04. Demo behavior is gated through `isDemoScenarioMode`, which returns true only for `gamePhase === "launch"`.
- Verify: `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\unit\runtime-demo-scenarios.test.js tests\unit\runtime-refactor-guard.test.js`, plus standard smoke/type/lint/test commands.

### PR 3: Extract Overflow Tooltip And Toast UI

- Goal: isolate self-contained UI-only behavior (`bindOverflowTextTooltips`, spy/attack/robbery toast rendering).
- Files: `page-assets/js/app/runtime.js`, `page-assets/js/app/ui/notifications.js`, `page-assets/js/app/ui/overflowTextTooltips.js`, `tests/unit/runtime-notifications.test.js`, `tests/unit/runtime-overflow-tooltips.test.js`.
- Risk: low-medium.
- Status: completed on 2026-05-04 for toast/notification rendering and overflow tooltip binding. Existing `showSpyToast`, `showAttackToast`, and `showRobberyToast` remain exported from `runtime.js`; the notification module also exposes `showToast`, `showSuccess`, `showError`, `showWarning`, and `clearNotifications`.
- Verify: `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\unit\runtime-notifications.test.js tests\unit\runtime-overflow-tooltips.test.js tests\unit\runtime-refactor-guard.test.js`, `node -e "import('./page-assets/js/app/render-ui.js').then(() => console.log('render-ui import ok'))"`, `npm run smoke:ui`; manual browser check on hover/focus tooltip and mission toast display if touching tooltip/toast code.

### PR 3b: Extract Resources And Storage Rendering

- Goal: move resource/storage DOM rendering without touching resource production, collect, market, craft, storage capacity, or state shape.
- Files: `page-assets/js/app/runtime.js`, `page-assets/js/app/ui/resourcesPanel.js`, `tests/unit/runtime-resources-panel.test.js`, `tests/unit/runtime-refactor-guard.test.js`.
- Risk: low-medium.
- Status: completed on 2026-05-04. `runtime.js` still owns state reads and public wrappers; `ui/resourcesPanel.js` renders topbar resources, influence/spy pill, gang member count, and storage popup counters.
- Verify: `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\unit\runtime-resources-panel.test.js tests\unit\runtime-refactor-guard.test.js`, `node -e "import('./page-assets/js/app/render-ui.js').then(() => console.log('render-ui import ok'))"`, plus standard smoke/type/lint/test commands.

### PR 4: Extract Result Modal Renderers

- Goal: move modal DOM rendering helpers while leaving payload creation and gameplay resolution in runtime.
- Files: `page-assets/js/app/runtime.js`, `page-assets/js/app/ui/battleReportPanel.js`, `page-assets/js/app/ui/resultModalPanel.js`, `tests/unit/runtime-battle-report-panel.test.js`, `tests/unit/runtime-result-modal-panel.test.js`.
- Risk: medium.
- Status: partially completed on 2026-05-04 for attack/battle report rendering, shared row rendering, and simple spy/raid result modal rendering. `runtime.js` keeps modal queue wrappers and still owns attack calculation, state mutation, heat, cooldowns, police live timers, and payload creation.
- Verify: `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\unit\runtime-result-modal-panel.test.js tests\unit\runtime-battle-report-panel.test.js tests\unit\runtime-refactor-guard.test.js`, `npm run smoke:ui`, targeted tests for attack/spy/building action flows, and manual open/close check for spy, attack, raid, and police modals.

### PR 4b: Extract District And Building Panel Rendering

- Goal: move selected district panel, visible building chip list, Buildings popup grids, and building action row DOM rendering while leaving map rendering, ownership, action availability, cooldown calculations, and gameplay callbacks in runtime.
- Files: `page-assets/js/app/runtime.js`, `page-assets/js/app/ui/districtPanel.js`, `page-assets/js/app/ui/buildingPanel.js`, `tests/unit/runtime-district-panel.test.js`, `tests/unit/runtime-building-panel.test.js`.
- Risk: low-medium.
- Status: completed on 2026-05-04. Runtime prepares view data and keeps `interactionState`, `resolveDistrictActions`, trap/police locks, building action effects, cooldown math, collect/upgrade/action handlers, and Buildings popup selection state.
- Verify: `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\unit\runtime-district-panel.test.js tests\unit\runtime-building-panel.test.js tests\unit\runtime-refactor-guard.test.js`, `node -e "import('./page-assets/js/app/render-ui.js').then(() => console.log('render-ui import ok'))"`, plus standard smoke/type/lint/test commands.

### PR 4c: Extract Legacy LocalStorage Boundary

- Goal: centralize browser-local legacy storage access without changing saved payload shape, gameplay mutation, or server-authoritative direction.
- Files: `page-assets/js/app/runtime.js`, `page-assets/js/app/model/authority-state.js`, `page-assets/js/app/persistence/legacyStorage.js`, `tests/unit/legacy-storage.test.js`.
- Risk: low-medium for localStorage wrappers; high for any future schema migration.
- Status: completed on 2026-05-04. Direct `localStorage` access was removed from `runtime.js` and `authority-state.js`; `authority-state` still owns preview session defaults and normalization.
- Preserved keys: `empireStreets.session.v1`, `empire_settings`, `empireStreets.districtBuildingDetails.v1`, `empireStreets.clinicRecoveryPool.v1`, and `empire_avatar`.
- Verify: `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\unit\legacy-storage.test.js tests\unit\page-auth-flow.test.js tests\unit\page-market-state.test.js tests\unit\runtime-refactor-guard.test.js`, `node -e "import('./page-assets/js/app/render-ui.js').then(() => console.log('render-ui import ok'))"`, plus standard smoke/type/lint/test commands.

### PR 4d: Add Runtime Orchestrator Facade

- Goal: make `runtime.js` start behaving like an orchestrator without moving gameplay logic or map rendering.
- Files: `page-assets/js/app/runtime.js`, `page-assets/js/app/render-ui.js`, `tests/unit/runtime-orchestrator.test.js`.
- Risk: medium because it touches boot and public exports.
- Status: completed on 2026-05-04. `bootstrapPage` delegates to `initRuntime`; `bindUiEvents` is idempotent per root; `refreshAllUi` refreshes safe UI surfaces and emits `empire:runtime-refresh`; `handleActionResult` gives future gameplay call sites a single action-result refresh path.
- Still excluded: map rendering, attack/server sync flow, police heat, building action mutation, production, market transactions, and saved-state schema migration.
- Verify: `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\unit\runtime-orchestrator.test.js tests\unit\runtime-refactor-guard.test.js`, `node -e "import('./page-assets/js/app/render-ui.js').then((m) => console.log(Boolean(m.initRuntime), Boolean(m.refreshAllUi), Boolean(m.handleActionResult)))"`, plus standard smoke/type/lint/test commands.

### PR 4e: Extract Player Profile Panel Rendering

- Goal: move only player profile popup DOM rendering while keeping state reads, formatting decisions, open/close handling, and runtime refresh binding in `runtime.js`.
- Files: `page-assets/js/app/runtime.js`, `page-assets/js/app/ui/playerProfilePanel.js`, `tests/unit/runtime-player-profile-panel.test.js`.
- Risk: low-medium.
- Status: completed on 2026-05-04. Runtime builds a view model from registration, faction, economy, gang, district count, alliance, avatar, and color helpers; the UI module renders text fields, avatar background, fallback, and profile button accent.
- Still excluded: profile popup binder extraction, registration flow, faction preview, wanted heat actions, and any server player projection migration.
- Verify: `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\unit\runtime-player-profile-panel.test.js tests\unit\runtime-orchestrator.test.js tests\unit\runtime-refactor-guard.test.js`, `node -e "import('./page-assets/js/app/render-ui.js').then(() => console.log('render-ui import ok'))"`, plus standard smoke/type/lint/test commands.

### PR 4f: Extract Map Constants And Data Adapter

- Goal: move map-only constants and pure district normalization helpers without touching canvas renderer, click flow, zoom/pan, ownership mutation, trap visuals, or overlay drawing.
- Files: `page-assets/js/app/runtime.js`, `page-assets/js/app/map/mapConstants.js`, `page-assets/js/app/map/mapDataAdapter.js`, `tests/unit/runtime-map-data-adapter.test.js`.
- Risk: low-medium because `getDistrictFillStyle` and `getDistrictOwnerLabel` now delegate to pure helpers while preserving branch behavior.
- Status: completed on 2026-05-04. Runtime still owns `renderDistrictCanvas`, `bindDistrictCanvas`, selected district state, `window.empireStreetsDistrictState`, active mission marker collection, popup flow, and gameplay action handlers.
- Verify: `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\unit\runtime-map-data-adapter.test.js tests\unit\runtime-map-rendering.test.js tests\unit\runtime-refactor-guard.test.js`, plus standard smoke/type/lint/test commands.

### PR 4g: Extract Map Geometry And Hit Testing

- Goal: move pure district type grid creation, launch owner map creation, district ID/type remapping, Voronoi-like geometry generation, adjacency lookup, and hit testing while leaving renderer, overlays, ownership mutation, click handlers, zoom/pan, and trap/toxic visuals unchanged.
- Files: `page-assets/js/app/runtime.js`, `page-assets/js/app/map/mapGeometry.js`, `tests/unit/runtime-map-geometry.test.js`, `tests/unit/runtime-map-rendering.test.js`.
- Risk: low-medium because canvas rendering still calls the same function names through the runtime facade.
- Status: completed on 2026-05-05. `runtime.js` imports and re-exports the geometry helpers for legacy test/UI compatibility.
- Verify: `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\unit\runtime-map-geometry.test.js tests\unit\runtime-map-rendering.test.js tests\unit\runtime-map-data-adapter.test.js`, plus standard smoke/type/lint/test commands.

### PR 5: Extract Static Building Display Data

- Goal: move variant name arrays into a data module without touching detail profiles, income rules, mechanics, cooldown calculations, or action availability.
- Files: `page-assets/js/app/runtime.js`, `page-assets/js/app/runtime/buildingDisplayData.js`, `tests/unit/runtime-building-display-data.test.js`.
- Risk: low-medium for this first slice because it only moves static display names. Detail profiles and mechanic maps remain in runtime.
- Status: first slice completed on 2026-05-05.
- Verify: `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\unit\runtime-building-display-data.test.js tests\unit\runtime-refactor-guard.test.js`, `npm run smoke:ui`, and targeted building tests.

### PR 5b: Extract Building Action UI Registry

- Goal: move building action labels, descriptions, icon labels, badges, disabled reason display text, action output summaries, and optional result rendering out of `runtime.js`.
- Files: `page-assets/js/app/runtime.js`, `page-assets/js/app/ui/buildingActionUiRegistry.js`, `page-assets/js/app/ui/buildingActionResultPanel.js`, `tests/unit/runtime-building-action-ui-registry.test.js`.
- Risk: low-medium because runtime still computes action availability and effect state, then passes that view context to the UI registry.
- Status: completed on 2026-05-05. Action effects, costs, cooldowns, production, heat, income, rewards, collect/upgrade handlers, and server/core handlers were not moved.
- Verify: `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\unit\runtime-building-action-ui-registry.test.js tests\unit\runtime-building-panel.test.js tests\unit\runtime-orchestrator.test.js`, plus targeted game-core building-action flow when gameplay code changes.

### PR 6: Extract Storage Popup Rendering

- Goal: move storage popup count rendering and DOM binding, but keep inventory state mutation in runtime.
- Files: `page-assets/js/app/runtime.js`, `page-assets/js/app/ui/resourcesPanel.js`.
- Risk: medium.
- Status: count rendering completed in PR 3b. Popup open/close binding remains in runtime because it is a legacy UI handler and does not materially reduce gameplay risk.
- Verify: `npm run smoke:ui`, storage popup manual check, production/craft targeted tests, and no change to inventory getter/setter exports.

Stop after PR 6. The next phase should add tests before extracting map rendering, attack/spy/robbery, police heat, market transactions, saved-state schema migration, or any building action effect/availability logic.

## Operational Rules For Refactor PRs

- Edit only `page-assets/js/app/runtime.js` and new canonical modules under `page-assets/js/app/`.
- Do not edit `client/page-assets/js/app/runtime.js` by hand.
- Keep `runtime.js` as the compatibility facade and preserve current export names.
- After each accepted source refactor, regenerate publish output through `npm run build:admin:page` if `client/` artifacts are part of the change.
- Do not move gameplay mutation into UI modules; server-authoritative replacements belong in `packages/game-core`, `packages/game-config`, `apps/server`, and `apps/client` transport/projection code.
