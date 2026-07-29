# Live demo / hosted UI parity audit

## Scope and baseline

The audit compares the explicit loopback-only `local-demo` runtime with the local hosted
`server-authoritative` runtime. The visual reference is the existing shared presentation in
`pages/game.html`; server gameplay remains authoritative and no demo fixture is enabled in the
hosted path.

Baseline artifacts are written outside Git to:

```text
artifacts/live-demo-ui-parity/baseline/<mode>/<viewport>/<surface>.{png,html,json}
```

Captured viewports:

- `desktop-1440x900`
- `mobile-390x844`

The JSON sidecar records the visible modal count, top overlay, body overflow, execution mode,
server state version, selected district and selected building. The HTML sidecar records the
actual visible shell rather than a generated fixture.

## Confirmed runtime ownership

| Surface | Local-demo renderer and data | Hosted renderer and data before the sprint | Styling |
| --- | --- | --- | --- |
| District popup | `runtime.js` map controller, local world/session state and deterministic building profile | The same `runtime.js` popup opened immediately from local map geometry, while `gameplay-slice-page.ts` also owned a hidden district sheet and authoritative read model | `styles.css`, `styles-district.css` |
| Restaurant and ordinary buildings | `buildingDetailPanel.js` with `buildingDetailViewModel.js` over local state | Legacy panel could open before the requested server district was loaded; the unused server controller had a second building-detail path | `styles.css`, `styles-district.css`, building-specific sections in `styles.css` |
| Pharmacy | `productionBuildingPopupRuntime.js`, local production state | Shared popup shell, but the building was resolved from the latest global gameplay slice rather than the physical requested district/building | `styles.css` |
| Drug Lab | `productionBuildingPopupRuntime.js`, local production state | Same race and latest-slice lookup as Pharmacy | `styles.css` |
| Factory | `factoryPopupRuntime.js`, local factory state | Shared popup shell with server factory projection, but selection could point at the previous district | `styles.css` |
| Armory | `productionBuildingPopupRuntime.js`, local production state | Shared popup shell with server armory projection, but selection could point at the previous district | `styles.css` |
| City Events | `city-events-runtime.js`, local demo tasks | The same runtime receives server agents/offers/active run and typed callbacks; ownership was not declared and modal-stack duplication was not diagnosed | `styles.css` |
| Gameplay slice panel | Not mounted in the explicit demo entrypoint | `gameplay-slice-page.ts` rendered its own topbar, map, district panel and `district_sheet` overlay inside a hidden root | `styles-gameplay-slice-client.css`, `styles-game-admin-slice.css` |

## Baseline differences

| Surface | Concrete baseline difference | Classification |
| --- | --- | --- |
| District popup | Hosted capture of `district:21` showed `blackout.png`, `Neznámý sektor`, hidden owner and no building chips. Demo showed the commercial atmosphere and Restaurant/Exchange chips. | Data race and duplicate ownership |
| District popup | Hosted JSON recorded `selectedDistrictId: 21` but no authoritative `stateVersion`; the legacy map selection had opened before a scoped server response. | Data race |
| Ordinary building detail | The shared detail could be opened from a local building label while the latest slice still represented another district. | Data race |
| Production buildings | Lookup helpers selected the first Pharmacy/Drug Lab/Factory/Armory in the latest slice. Identity was not scoped by `serverInstanceId + districtId + buildingId`. | Data mapping |
| Gameplay slice overlay | The hidden slice root still created click handlers, a district sheet, modal ownership and scroll locking. CSS hiding did not prevent lifecycle side effects. | Duplicate ownership |
| City Events | The visible markup was shared, but there was no development invariant proving a single main modal, detail modal and scroll-lock owner. | Duplicate ownership risk |
| Mobile | The same stale district content was rendered in the mobile shell; nested visible-dialog counting also counted shell and inner `role=dialog` as two different modals. | Data race and diagnostics defect |

## Primary cause

The production entrypoint intentionally retained `runtime.js` for the polished shared game
presentation, but the gameplay slice page was mounted as a second full presentation. At the same
time, the legacy map click called `openPopup(district)` synchronously and only later could the
transport load an authoritative district. Building shortcuts therefore consumed an unscoped
“latest slice”, making the result dependent on request timing and the previously selected district.

The correction must keep one visible shared renderer and turn the gameplay slice page into a
controller/read-model/command source. A district or building can be presented only after the
server response matches the requested canonical district and, for a building, the exact physical
building identity.

## Baseline verification

- Node runtime: `v24.18.0`
- `npm run check:node`: passed
- targeted runtime/unit baseline: 43 passed, three pre-existing import-timeout failures in the
  broad baseline invocation
- explicit local-demo capture: all eight surfaces captured at both target viewports
- hosted entry flow: PostgreSQL account registration, lobby selection, spawn, faction and
  gameplay session succeeded
- hosted visual capture stopped after the first district artifact exposed the stale district
  selection; the failure was retained as the pre-fix proof rather than relabelled as a pass

## Required ownership contract

```text
server-authoritative
  gameplay-slice page (controller-only transport/read-model/typed commands)
    -> scoped district selection
      -> shared legacy presentation shells

local-demo
  local demo state adapter
    -> the same shared legacy presentation shells
```

Spawn selection may temporarily use the gameplay-slice surface while the server is in
`awaiting_spawn_selection`. No other production state may create a second visible topbar, map,
district panel, building detail or City Events modal.

## Implemented ownership model

The hosted game now mounts `gameplay-slice-page.ts` with
`presentationMode: "controller-only"`. In this mode it keeps the gameplay session, polling,
read-model publication and typed command transport, but does not create a second visible topbar,
map, district panel, building card, building detail or `district_sheet` overlay. Spawn selection
remains the only explicit presentation exception.

The visible hosted surface is the same shared presentation used by the explicit local demo:

```text
server gameplay read model
  -> serverDistrictSelectionCoordinator.js
  -> ServerBuildingPresentationAdapter
  -> buildingDetailPanel.js / shared production popup runtimes

local demo state
  -> LocalDemoBuildingPresentationAdapter
  -> buildingDetailPanel.js / shared production popup runtimes
```

The adapters only normalize presentation data. Local demo retains its isolated local mutations.
The server adapter never computes a gameplay result and never writes demo production state; all
hosted production and City Events actions continue through typed server commands.

## Canonical district and building selection

Hosted district presentation no longer opens synchronously from unverified legacy geometry.
`serverDistrictSelectionCoordinator.js` first requests the canonical district, waits for the
response and verifies that the response district matches the request. Building presentation is
then resolved by the physical identity:

```text
serverInstanceId + districtId + buildingId
```

The request generation prevents a delayed response for district A from replacing a newer
selection of district B. A missing or mismatched district/building fails closed with a scoped
loading or error state instead of opening a local card or the first matching building from the
latest global slice.

## Shared production and City Events presentation

- Restaurant and ordinary building details use `buildingDetailPanel.js` in both modes.
- Pharmacy, Drug Lab and Armory use `productionBuildingPopupRuntime.js` with either the local-demo
  state adapter or authoritative server production projection and typed commands.
- Factory uses the same visible factory shell through `factoryPopupRuntime.js`.
- Successful hosted command responses update the server gameplay read-model source and refresh the
  currently open shared modal instead of falling back to local storage.
- City Events use one trigger, one shared main modal, one shared detail modal and one modal-stack
  owner. The hosted adapter supplies server offers, active runs and typed command callbacks; the
  local demo adapter supplies demo tasks.

## Development-only ownership diagnostics

`uiOwnershipDiagnostics.js` runs only on loopback with the explicit debug/E2E switch. It records
execution mode, requested and selected district/building IDs, state version, active overlay and
visible modal owners. It reports:

- more than one visible district popup,
- more than one visible building detail,
- more than one City Events main/detail modal,
- more than one active district-sheet overlay,
- duplicate IDs among visible modal roots,
- a hidden renderer retaining the body scroll lock.

Visible roots identify their owner with `data-ui-owner`:

- `legacy-shared` for district and building presentation,
- `city-events-shared` for City Events,
- `server-slice` for the controller-only gameplay slice and spawn selection.

## Card design clarification

The word “repair” in this sprint means repairing the existing building-card presentation and
layout. It does **not** mean adding a building-repair gameplay mechanic. No
`RepairBuildingCommand`, repair mutation, new balance rule or repair button was added. The current
shared command catalogue has no such command, so server authority and gameplay rules remain
unchanged.

## Browser coverage prepared

The parity harness captures screenshots, visible DOM, CSS classes, modal ownership, overlay,
overflow, execution mode, state version and selected IDs under:

```text
artifacts/live-demo-ui-parity/<phase>/<mode>/<viewport>/
```

Prepared hosted coverage:

- `live-production-pharmacy.spec.js`
- `live-production-drug-lab.spec.js`
- `live-production-factory.spec.js`
- `live-production-armory.spec.js`
- `live-city-events.spec.js`
- `live-demo-ui-parity.spec.js`
- `live-district-selection-race.spec.js`

The harness also fails on console/page errors, duplicate visible owners and any server-authoritative
write to demo gameplay, production or factory storage keys. Dynamic countdowns and identifiers are
masked for visual comparisons.

## Deferred validation status

Before the owner deferred further test execution, JavaScript syntax checks, Playwright test
discovery and the client page build completed successfully. A first hosted Pharmacy attempt reached
the lobby but the disposable server registration window had expired before gameplay entry; it did
not exercise the modal. A fresh disposable server was provisioned, but the rerun and the full
Node 24 verification gate are intentionally deferred to the owner's next prompt. They must not be
reported as passed until they actually run.
