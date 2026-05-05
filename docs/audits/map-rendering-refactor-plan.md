# Map Rendering Refactor Plan

Datum auditu: 2026-05-04
Aktualizace: 2026-05-05, první bezpečný refaktor mapy dokončen pro constants, data adapter, čistou geometrii, adjacency a hit testing.

## Scope

Tento audit pokrývá canonical source `page-assets/js/app/runtime.js` a map navigation helper `page-assets/js/app/map-navigation.js`.

Nezměněno:

- map draw order,
- district ownership logika,
- barvy zón,
- trap/toxic trap rendering,
- click handlery,
- zoom/pan,
- výběr districtu,
- gameplay výpočty útoku, obsazení, robbery, spy, policie a budov.

Canonical source zůstává root `page-assets/`. `client/` je generated publish output přes `scripts/build-netlify-client.mjs` a nebyl ručně upraven.

## Load Path

Mapa se načítá přes ESM cestu:

- `pages/game.html:2050` načítá `<script type="module" src="../page-assets/js/app.js">`
- `page-assets/js/app.js` importuje `bootstrapPage` z `./app/render-ui.js`
- `page-assets/js/app/render-ui.js` re-exportuje map bindery přes `./features/map.js`
- `page-assets/js/app/features/map.js` re-exportuje `bindDistrictCanvas`, `bindMapNavigation`, `bindMapPhaseToggle`, `bindBorderColorToggle`, `bindGamePhaseToggle` z `runtime.js` / `map-navigation.js`

Runtime je tedy ESM, ne classic script. HTML nemá inline `onclick` handlery pro mapu.

## Current Inventory

| Oblast | Soubor / řádky | Role | Riziko |
| --- | --- | --- | --- |
| District type grid | `map/mapGeometry.js` | Vytvoří 7 x 23 grid typů districtů a fallback `resident`; runtime importuje a re-exportuje původní API. | Low-medium |
| Launch owner map | `map/mapGeometry.js`, `runtime.js` | DEV/launch vlastnictví přes `START_PHASE_OWNER_BY_DISTRICT_ID`; helper je pure, konkrétní demo coordinates zůstávají v `dev/demoScenarios.js`. | Medium |
| Type visibility | `runtime.js:7173` | Skrývá typ districtu podle launch/live fáze, spy intel a ownership. | High |
| Atmosphere meta | `runtime.js:7193`, `11481` | Labely, mood text a obrázek typu districtu v popupu. | Low |
| Fill style | `runtime.js`, `map/mapDataAdapter.js` | Barva výplně podle destroyed, owner, hidden, zone type a day/night. Pure fallback helpers jsou v data adapteru. | High |
| Geometry | `map/mapGeometry.js` | Voronoi-like polygon generátor pro 161 districtů, remap ID, center/polygon data. | Low-medium |
| Hit testing | `map/mapGeometry.js` | `getDistrictAtPoint` a `isPointInDistrict` pro hover/click. | Low-medium |
| Canvas renderer | `runtime.js:13056` | Kreslí background image/fallback, fills, borders, selected highlight, owner glyphy a overlay animace. | High |
| Overlay animace | `runtime.js:12270-12977` | Spy, police, attack, robbery, trap, occupy, alliance, bounty, reduced effects. | High |
| Binder/interakce | `runtime.js:13304-16700` | DOM query, hover canvas, tooltip, popupy, action buttons, redraw/event listeners. | Very high |
| District API bridge | `runtime.js:15884-15963` | `window.empireStreetsDistrictState` pro capture/destroy/selection/refresh. | Very high |
| Zoom/pan | `map-navigation.js:11-196` | Wheel zoom, zoom buttons, drag, pinch, transform na `[data-map-canvas]`. | Medium |

## Main Map Data Model

Mapa nepřichází jako externí JSON. Je generovaná v runtime:

- `DISTRICT_TYPE_GRID = createDistrictTypeGrid(7, 23)` tvoří 161 buněk v `map/mapGeometry.js`.
- `createDistrictGeometry(width, height, insetX, insetTop, insetBottom)` tvoří polygonová data v `map/mapGeometry.js`.
- Každý district má minimálně:
  - `id`,
  - `rowIndex`,
  - `columnIndex`,
  - `districtType`,
  - `centerX`,
  - `centerY`,
  - `polygon`.
- Některá ID jsou remapovaná přes `remapDistrictId`, aby seděla s ručně laděnou mapou.
- Typ zóny se bere přes `classifyDistrictType` a `remapDistrictType`, které jsou čisté helpery v `map/mapGeometry.js`.

Runtime k tomu přidává live stav:

- `interactionState.selectedDistrictId`,
- `interactionState.hoveredDistrictId`,
- `interactionState.ownedDistrictIds`,
- `interactionState.destroyedDistrictIds`,
- `interactionState.launchOwnerByDistrictId`,
- aktivní spy/police/attack/occupy/robbery/trap sety a marker mapy,
- settings: borders, alliance symbols, reduced effects, map visibility mode.

## District Data Sources

Primární zdroje dat:

- statický/dev config z `page-assets/js/app/dev/demoScenarios.js`,
- session/world state přes `page-assets/js/app/model/authority-state.js`,
- legacy localStorage přes `page-assets/js/app/persistence/legacyStorage.js`,
- combat/economy/faction legacy config z `packages/game-config/src/legacy-page/*`,
- combat/spy preview rules z `packages/game-core/src/legacy-page/*`,
- DOM dataset na `[data-map-phase]` pro phase bridge,
- obrázky mapy z `DAY_MAP_IMAGE_PATH` a `NIGHT_MAP_IMAGE_PATH`.

Server-authoritative směr je částečně připravený přes `getAuthoritySession()`: pokud existuje `window.empireStreetsServerState.session` nebo `window.empireStreetsServerSession`, runtime čte server session místo browser preview state.

## Ownership

Ownership má dvě vrstvy:

- Launch/DEV fáze:
  - používá `START_PHASE_OWNER_BY_DISTRICT_ID`,
  - více hráčů má předvyplněné startovní districty,
  - aktuální hráč se značí přes `CURRENT_PLAYER_ID`.
- Live/free flow:
  - používá `world.ownedDistrictIds`,
  - destroyed districty se odstraňují z owner mapy,
  - capture/destroy akce volají `window.empireStreetsDistrictState.captureDistrict/destroyDistrict`.

Důležité napojení:

- `completeAttackOrder` a `applyOccupyAction` mutují world state a potom volají district API bridge.
- `document.dispatchEvent("empire:world-state-changed")` triggeruje resync `interactionState` a redraw mapy.

Riziko: ownership není jen render state. Je přímo napojený na attack result, occupy flow, popup state, available district actions a player profile district count.

## Zone Colors

`getDistrictFillStyle` rozhoduje výplň v tomto pořadí:

1. destroyed district,
2. launch phase mimo efektivně owned districty je transparentní,
3. launch owner color,
4. current player owned color,
5. hidden district grey fallback,
6. zone palette:
   - `downtown`,
   - `industrial`,
   - `resident`,
   - `economy`,
   - `park`,
   - fallback `resident`.

V auditu byl přidán guard pro neúplný `district` objekt a chybějící `districtType`, ale platné district objekty se kreslí stejnou cestou jako předtím.

## Overlays

Renderer kreslí tyto overlay vrstvy:

- selected district highlight,
- borders podle nastavení,
- owner border/glow,
- current player faction badge nebo alliance badge,
- enemy launch label (`P1`, `P2`, ...),
- bounty highlight + badge,
- spy animation,
- police animation,
- attack animation,
- occupy animation + countdown,
- robbery animation,
- trap/toxic trap animation,
- reduced-effect ikony, pokud hráč vypnul animace.

Heatmap ani influence overlay jako samostatná plošná mapová vrstva nebyly v `renderDistrictCanvas` nalezeny. Heat a influence se zobrazují v district popup metrikách a souvisejících UI panelech, ne jako separátní canvas overlay.

## Interactions

Interakce jsou dnes smíchané v `bindDistrictCanvas`:

- query všech map/popup/action DOM elementů,
- vytvoření `.map-interaction-overlay`,
- vytvoření `.map-hover-canvas`,
- hover canvas redraw,
- tooltip update,
- gesture tracking pro potlačení kliknutí po dragu/pinchi,
- click hit-test přes `getDistrictAtPoint`,
- selected district state update,
- otevření district popupu,
- otevření attack/robbery/defense/trap/spy/occupy confirm popupů,
- Buildings popup render a delegované kliky,
- close handlery,
- keydown Escape handlery,
- image loading a fallback render,
- animation loop pro aktivní map mise.

Zoom/pan je oddělený v `map-navigation.js`, ale stále pracuje přímo nad DOM:

- wheel zoom,
- zoom button click,
- pointer drag,
- mobile pinch,
- `transform: translate(...) scale(...)` na `[data-map-canvas]`,
- suppression flag `data-map-gesture-suppress-until`, který potom čte click handler mapy.

## DOM / Canvas Elements

Kritické HTML anchor prvky:

- `#game-map-stage`,
- `#game-map-mount`,
- `[data-map-viewport]`,
- `[data-map-canvas]`,
- `[data-district-canvas]`,
- `[data-district-tooltip]`,
- `[data-district-popup]`,
- `[data-buildings-popup]`,
- attack/robbery/defense/trap/spy/occupy popup elementy,
- map phase/border/game phase buttons.

Runtime dynamicky přidává:

- `.map-interaction-overlay`,
- `.map-hover-canvas`.

## Global State And Events

Map rendering čte nebo mění:

- `window.empireStreetsDistrictState`,
- `window.empireStreetsAllianceState`,
- `window.empireStreetsBountyState`,
- `window.empireStreetsServerState`,
- `window.empireStreetsServerSession`,
- `document` events:
  - `empire:settings-changed`,
  - `empire:world-state-changed`,
  - `empire:police-state-changed`,
  - `keydown`,
- `window` events:
  - `empire:alliance-state-changed`,
  - `empire:bounty-state-changed`,
  - `beforeunload`.

Veřejný bridge, který musí zůstat kompatibilní:

- `revealDistrictType(districtId)`,
- `concealDistrictType(districtId)`,
- `captureDistrict(districtId)`,
- `destroyDistrict(districtId)`,
- `loseDistrict(districtId)`,
- `setOwnedDistricts(districtIds)`,
- `getDistrictById(districtId)`,
- `getSelectedDistrict()`,
- `refreshSelectedDistrictPanel()`,
- `getState()`.

## UI-Only Vs Gameplay-Coupled

UI-only kandidáti:

- pure polygon drawing helpers,
- map background image/fallback drawing,
- tooltip positioning/rendering,
- owner badge drawing,
- reduced-effect icon drawing,
- map legend labels,
- hover canvas outline.

Mixed / gameplay-coupled:

- fill style, protože používá ownership, destroyed state, launch owner map a spy visibility,
- `render()` uvnitř `bindDistrictCanvas`, protože sbírá active missions, police actions, traps a world state,
- selected district popup, protože obsahuje defense, economy, building chips, gossip a action availability,
- `window.empireStreetsDistrictState`, protože mění selected/captured/destroyed state a triggeruje redraw,
- click handler, protože kromě selection otevírá police/attack result modal,
- action button handlery, protože spouštějí attack, robbery, defense, trap, spy a occupy flow.

## Refactor Risks

Největší rizika:

1. `bindDistrictCanvas` není jen map binder. Je to map renderer, selected district controller, modal controller a gameplay action hub.
2. `interactionState` je lokální closure state, který zároveň odráží world state, settings, active missions, selected district a animation loop.
3. Ownership render je propojený s attack/occupy výsledky přes `window.empireStreetsDistrictState`.
4. Geometry ID remap může rozbít budovy, popups, spy/attack targety a testovací data, pokud se vytáhne bez golden testů.
5. Map click suppression je sdílený mezi `map-navigation.js` a `bindDistrictCanvas`; rozdělení bez kontraktu může znovu otevřít chyby s klikem po dragu.

## Safe Guards Added

Malé guardy přidané v tomto kroku:

- `renderDistrictCanvas(null, ...)` bezpečně vrací `null`.
- `renderDistrictCanvas` bezpečně vrací `null`, pokud canvas nemá `getContext("2d")`.
- `getDistrictFillStyle` má fallback district `{ id: 0, districtType: "resident" }`.
- `getDistrictAtPoint` vrací `null`, pokud chybí geometry, `geometry.districts` nebo point.
- `isPointInDistrict` vrací `false`, pokud district nemá platný polygon.

Již existující guardy:

- `bindDistrictCanvas` skončí bez pádu, pokud chybí canvas, phase host, viewport nebo canvas host.
- `syncPhaseHostFromAuthority(null)` vrátí phase state bez DOM zápisu.
- `classifyDistrictType` a `remapDistrictType` používají fallback `resident`.
- overlay sety/mapy mají prázdné fallbacky.
- map image load failure vede na gradient fallback a render pokračuje.

## Smoke Coverage

Přidaný test: `tests/unit/runtime-map-rendering.test.js`

Ověřuje:

- render nespadne bez canvasu,
- canvas render proběhne s mock 2D contextem a chybějícími overlay daty,
- hit-test vrátí district pro bod v polygonu,
- missing geometry při hit-testu vrátí `null`,
- missing zone fallback zůstává `resident`,
- redraw po mock ownership změně nespadne,
- simulovaný click přes hit-test nastaví selected district id a redraw vykreslí selected highlight,
- owned district fill zůstává oddělený od unowned zone fill,
- current-player ownership stroke používá stejnou hráčskou barvu jako startovní district.

Rozšířený smoke: `scripts/smoke-ui-pages.mjs`

Ověřuje, že `pages/game.html` stále obsahuje kritické mapové anchor prvky:

- `#game-map-stage`,
- `#game-map-mount`,
- `[data-map-viewport]`,
- `[data-map-canvas]`,
- `[data-district-canvas]`,
- tooltip,
- district popup,
- buildings popup.

Plně automatizovaný click callback přes `bindDistrictCanvas` zatím není přidaný, protože tento binder je stále silně smíchaný s popupy a gameplay akcemi. Před jeho testováním je bezpečnější nejdřív vytáhnout čistý map data adapter nebo vytvořit užší callback rozhraní.

## Future Split

### mapDataAdapter

Cíl: převést world/settings/missions state na čistý `MapViewModel`.

Vstupy:

- world state,
- phase state,
- settings,
- spy/attack/robbery/occupy orders,
- police actions,
- trap state,
- alliance/bounty providers.

Výstup:

- `ownedDistrictIds`,
- `destroyedDistrictIds`,
- marker mapy,
- visibility mode,
- phase,
- selected/hovered id.

### mapRenderer

Cíl: přijmout canvas, geometry, phase a `MapViewModel` a pouze kreslit.

Patří sem:

- background image/fallback,
- district fills,
- borders,
- selected highlight,
- owner glyphy,
- base canvas overlay.

Nepatří sem:

- čtení localStorage/server state,
- popupy,
- gameplay actions,
- event listeners.

### mapInteractions

Cíl: DOM pointer/wheel/keyboard binding nad mapou.

Patří sem:

- hover,
- click,
- gesture suppression,
- pointer-to-canvas coordinate transform,
- callbacky `onDistrictHover`, `onDistrictSelect`, `onMapClear`.

### mapOverlays

Cíl: oddělit kreslení aktivit a ikon.

Patří sem:

- spy,
- police,
- attack,
- robbery,
- trap,
- occupy,
- bounty,
- alliance/current player badge,
- reduced-effect markers.

### mapSelection

Cíl: selected district state + bridge kompatibilita.

Patří sem:

- selected id,
- `window.empireStreetsDistrictState`,
- capture/destroy/lose/setOwned wrappers,
- refresh selected panel callback.

### mapLegend

Cíl: textové labely pro zone/owner/overlay legendy mimo gameplay.

Patří sem:

- district type labels,
- owner labels,
- hidden/known labels,
- lightweight map UI copy.

## Recommended First Safe Map Refactor

První bezpečný PR krok byl dokončen 2026-05-05:

- Název: Extract pure map geometry and hit testing.
- Cíl: přesunout pouze `createStops`, `clipPolygonAgainstBisector`, `remapDistrictId`, `remapDistrictType`, `createDistrictGeometry`, `isPointInDistrict`, `getDistrictAtPoint` do `page-assets/js/app/map/mapGeometry.js`.
- Zachovat exporty z `runtime.js` jako compatibility facade.
- Neměnit `bindDistrictCanvas`, `renderDistrictCanvas`, fill colors, ownership ani click handlers.
- Testy: golden počet districtů 161, stabilní remap ID, hit-test pro několik polygon centerů, null geometry guard.
- Ruční ověření: načíst game page, kliknout vlastní/cizí/prázdný district, zavřít popup, drag/zoom/pinch, spustit attack/spy/robbery marker bez runtime erroru.

Teprve potom má smysl oddělovat `mapRenderer`. `bindDistrictCanvas` by měl zůstat poslední větší krok, protože stále drží nejvíc gameplay vazeb.

## Refactor Step 1 Status

Dokončeno 2026-05-04:

- Přidán `page-assets/js/app/map/mapConstants.js`.
- Přidán `page-assets/js/app/map/mapDataAdapter.js`.
- `runtime.js` dál drží map renderer, click handlery, zoom/pan napojení, district selection, ownership mutace a popup/action flow.
- Do constants byly přesunuty district type metadata, zone fill styles, owner/fallback labely, map geometry sizing hodnoty, reduced-effect marker colors a map-only CSS class names.
- Do adapteru byly přidány pure helpery pro:
  - fallback zone key,
  - zone fill style fallback,
  - destroyed/hidden/launch-unowned fill style,
  - owner normalization,
  - district owner label resolution,
  - building list normalization,
  - jednoduchý district view model.
- `getDistrictFillStyle` a `getDistrictOwnerLabel` v runtime používají nový adapter, ale samotné větvení renderu a ownership flow se neměnily.

Ověření:

- `tests/unit/runtime-map-data-adapter.test.js`
- `tests/unit/runtime-map-rendering.test.js`
- `tests/unit/runtime-refactor-guard.test.js`

## Refactor Step 2 Status

Dokončeno 2026-05-05:

- Přidán `page-assets/js/app/map/mapGeometry.js`.
- Přesunuto: district type grid, launch owner map helper, remap ID/type helpers, polygon clipping, geometry generation, adjacency lookup a hit testing.
- `runtime.js` importuje a re-exportuje původní helper names pro legacy kompatibilitu.
- Nezměněno: canvas renderer, ownership fill, overlaye, reduced-effect markers, trap/toxic trap rendering, click handlery, zoom/pan, selected district state.

Ověření:

- `tests/unit/runtime-map-geometry.test.js`
- `tests/unit/runtime-map-rendering.test.js`
- `tests/unit/runtime-map-data-adapter.test.js`

Další bezpečný krok: extrahovat čistý `mapRenderer` až po přidání browser/screenshot smoke testu, který otevře skutečnou stránku a ověří viditelnou mapu i klik na district.

## Guard Step 3 Status

Dokončeno 2026-05-05:

- Renderer nebyl přesunut ani vizuálně měněn.
- `tests/unit/runtime-map-rendering.test.js` teď zaznamenává `fill`/`stroke` styly v mock canvas contextu.
- Přidán guard pro simulovaný click výběr:
  - hit-test vybere district podle center pointu,
  - `selectedDistrictId` se předá do redraw,
  - renderer musí nakreslit orange selected highlight a selected border.
- Přidán guard pro ownership fill:
  - unowned zone fill a owned player fill musí být rozdílné,
  - owned fill je `#ef444433`,
  - current-player ownership stroke je `#ef4444`.
- `scripts/smoke-ui-pages.mjs` hlídá, že `pages/game.html` neztratí kritické mapové DOM anchor prvky.

Ověření:

- `node scripts/run-local-bin.mjs vitest/vitest.mjs run tests/unit/runtime-map-rendering.test.js`

Další bezpečný krok:

- Vytvořit `mapRenderer` modul až po přidání skutečného browser smoke/screenshot testu přes dostupný browser runner. Pokud v projektu zůstane pouze Vitest bez Playwrightu, první praktický krok je vytáhnout jen pure renderer helpers, které přijímají `context` a nemají přístup k `window`, `document` ani gameplay state.
