# Runtime Quality Gate

Datum: 2026-05-05

## Scope

Quality gate ověřuje canonical source `page-assets/js/app/runtime.js` po sérii bezpečných refaktorů. `client/` je generated publish output a v tomto kroku nebyl ručně upraven.

## Runtime Size And Extraction Metrics

| Metrika | Hodnota | Poznámka |
| --- | ---: | --- |
| Původní runtime podle `runtime-and-publish-output-audit.md` | 19 145 řádků | Starší audit canonical root runtime před sérií refaktorů. |
| Runtime podle `runtime-refactor-map.md` před poslední map extrakcí | 18 502 řádků | Stav po většině UI/persistence refaktorů. |
| Aktuální `page-assets/js/app/runtime.js` | 17 721 řádků | Změřeno 2026-05-05 po map geometry a building display-data extrakci. |
| Snížení proti staršímu auditu | -1 424 řádků | Runtime je menší, ale pořád velký legacy orchestrator. |
| Snížení proti poslednímu refactor map inventáři | -781 řádků | Po vytažení map geometry/hit testingu a static building variant names. |
| File-size budget | 19 284 řádků | `npm run lint:file-sizes` prošel. |
| Nové canonical runtime-adjacent moduly | 17 | Pod `page-assets/js/app/runtime`, `ui`, `persistence`, `dev`, `map`. |
| Exportované helper/render/storage/data API v nových modulech | 467 symbolů | Mechanicky počítané `export function` + `export const`; zahrnuje selector/constants data. |
| Celkem function-like deklarací v nových modulech | 132 | Včetně interních helperů modulů. |

## Extracted Modules

| Modul | Řádky | Role |
| --- | ---: | --- |
| `runtime/constants.js` | 363 | Selektory, asset cesty a data-only runtime constants. |
| `runtime/formatters.js` | 72 | Formattery měn, district metrik a cooldownů. |
| `runtime/utils.js` | 75 | Čisté utility pro čísla, barvy, seeded random a URL. |
| `runtime/buildingDisplayData.js` | 430 | Static building variant display names. |
| `dev/demoScenarios.js` | 131 | Demo/dev scenario registry a demo mode guard. |
| `ui/notifications.js` | 249 | Toast/notification rendering. |
| `ui/overflowTextTooltips.js` | 97 | Overflow tooltip binding. |
| `ui/resourcesPanel.js` | 386 | Topbar resources, storage counters, resource summary UI. |
| `ui/battleReportPanel.js` | 136 | Battle report modal rendering. |
| `ui/resultModalPanel.js` | 93 | Shared result modal row/render helpers. |
| `ui/districtPanel.js` | 229 | District summary, metrics, flags, building chips, action rows. |
| `ui/buildingPanel.js` | 214 | Buildings popup tabs/detail/action rows. |
| `ui/playerProfilePanel.js` | 93 | Player profile popup rendering. |
| `persistence/legacyStorage.js` | 241 | Browser-local legacy storage boundary and safe parse. |
| `map/mapConstants.js` | 147 | Map constants, zone colors, labels, CSS class names. |
| `map/mapDataAdapter.js` | 150 | Pure map normalization helpers and district view model helpers. |
| `map/mapGeometry.js` | 325 | Pure district grid, launch owner map helper, geometry, adjacency and hit testing. |

## What Still Remains In Runtime

Runtime is still responsible for these high-coupling areas:

- boot/orchestration compatibility facade: `bootstrapPage`, `initRuntime`, `bindUiEvents`, `refreshAllUi`;
- map renderer and interaction binder: `renderDistrictCanvas`, `bindDistrictCanvas`, hover/click selection, district popup wiring, animation loop;
- map rendering usage of imported geometry helpers: pure geometry and hit testing now live in `map/mapGeometry.js`, but renderer/click binding still depend on them;
- district ownership bridge: `window.empireStreetsDistrictState`;
- attack, occupy, robbery, spy and trap local preview flows;
- police heat/wanted/raid preview and dev-only police pressure;
- building action effects, cooldown checks, collect logic, special building popup binders;
- market popup transactions and dirty heat side effects;
- production/crafting preview timers and special production popups;
- player/profile/registration state reads and popup binders;
- legacy result queue/payload creation around some spy/raid/police flows.

## Checks Run

| Check | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm run smoke:ui` | Pass |
| `npm run lint:architecture` | Pass |
| `npm run lint:file-sizes` | Pass |
| Relevant runtime/map/building/police target suite | Pass, 6 files / 21 tests |
| `npm run test` | Pass, all unit/integration/server/persistence/read-model tests |
| `git diff --check` | Pass, only line-ending warnings reported |

## Flow Coverage

| Flow | Gate evidence | Result |
| --- | --- | --- |
| Boot hry | `runtime-refactor-guard`, `runtime-orchestrator`, `page-onboarding-smoke`, `smoke:ui` | Pass |
| Profile popup | `runtime-player-profile-panel`, `runtime-orchestrator`, guard export/binder checks | Pass |
| Resource render | `runtime-resources-panel`, `page-onboarding-smoke` | Pass |
| District panel | `runtime-district-panel`, `runtime-refactor-guard` | Pass |
| Building panel | `runtime-building-panel`, `district-building-slice`, `building-action-flow` | Pass |
| Toast notification | `runtime-notifications` | Pass |
| Battle report | `runtime-battle-report-panel`, `runtime-result-modal-panel`, attack integration tests | Pass |
| localStorage load/save | `legacy-storage`, `page-auth-flow`, `page-market-state` | Pass |
| Mapa | `runtime-map-rendering`, `runtime-map-data-adapter`, `runtime-map-geometry` | Pass |
| Výběr districtu | map geometry hit-test/unit guard + district state API guard | Pass with debt |
| Spy | `runtime-demo-scenarios`, `conflict-command-flow`, spy legacy exports | Pass with debt |
| Attack | `attack-district-flow`, `conflict-command-flow`, battle report tests | Pass |
| Heat feedback | `authoritative-gameplay-rules`, `building-action-flow`, `police-read-model`, wanted/heat runtime guard coverage | Pass with debt |

## What Did Not Pass

No current blocker failed in the final gate.

Note: during a previous run of the same test suite, `tests/persistence/snapshot.test.ts` failed once on the tamper-token assertion and then passed when rerun standalone and in the final full `npm run test`. Treat this as a residual flake candidate, not a runtime regression.

## Blockers

None for continuing with small, config-driven building work.

Potential blockers before large runtime changes:

- no browser E2E currently opens the real game page and clicks district/building/profile/toast flows end to end;
- map click/selection is still mostly protected through hit-test/unit guards and static runtime guard, not a full DOM/canvas click integration;
- police heat/wanted/raid UI is still legacy runtime-coupled, but the first server-side police read model now exists for heat source aggregation, wanted-level projection, raid pressure, and pending raid state.

## Acceptable Debt

- `runtime.js` is still 17 721 lines and remains a legacy compatibility facade.
- `bindDistrictCanvas` is still too broad: renderer, map selection, popup controller, action hub and animation loop are coupled.
- Attack/spy/robbery/trap flows still keep local timers and local preview mutations.
- Building actions are tested heavily in core/integration, but legacy UI action wiring remains coupled to runtime.
- Some report/police modal payload creation is still in runtime.
- `client/` publish output remains stale until intentionally regenerated.

## Before Adding More Buildings

Safe to add more buildings only if:

- building definitions stay in canonical config/source, not generated `client/`;
- each building gets focused config/core/integration coverage;
- no new building requires broad `bindDistrictCanvas` or map renderer edits;
- no building adds new localStorage schema without migration guard;
- UI additions use existing building panel rendering helpers where possible;
- `npm run typecheck`, `npm run smoke:ui`, `npm run lint:architecture`, `npm run lint:file-sizes`, relevant unit/integration tests, and full `npm run test` pass.

## Before Police Wiring

Not ready for large police/server-runtime wiring yet. Safe next police work remains test-first:

- expand the new server-side police projection contract if the UI needs more fields;
- add focused tests for tick/server runtime police scheduling before wiring live timers;
- wire legacy UI to projection data only after heat math, raid math, and action payloads remain covered.

Small police UI cleanup is acceptable if it does not change heat math, raid math, or attack/building action side effects.

## Can Be Done Later

- Add browser E2E for boot/profile/resources/district/building/map click.
- Move remaining static building detail profiles into a data module after focused building panel tests.
- Move market normalizers out of runtime.
- Replace local preview mission timers with server-authoritative command/result projections.

## Decision

It is safe to continue adding buildings in small, tested PR-sized steps.

It is not yet safe to do a broad police integration or broad map renderer refactor. Police should continue through projection-backed tests, and map renderer extraction should wait for browser/screenshot coverage.
