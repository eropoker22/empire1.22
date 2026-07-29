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
