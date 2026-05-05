# bindDistrictCanvas Refactor Audit

Date: 2026-05-05

## Canonical Source

- Canonical runtime: `page-assets/js/app/runtime.js`
- Generated runtime copy: `client/page-assets/js/app/runtime.js`
- Rule followed: `client/` was not edited by hand; regenerate it through the page build when publishing.

## Size

- Runtime before this pass: 13,062 lines
- Runtime after this pass: 12,998 lines
- Runtime delta: -64 lines
- `bindDistrictCanvas` before this pass: 3,387 lines
- `bindDistrictCanvas` after this pass: 3,292 lines
- `bindDistrictCanvas` delta: -95 lines

Mission marker view-model follow-up:

- Runtime before marker follow-up: 12,998 lines
- Runtime after marker follow-up: 12,812 lines
- Runtime delta in marker follow-up: -186 lines
- `bindDistrictCanvas` before marker follow-up: 3,292 lines
- `bindDistrictCanvas` after marker follow-up: 3,100 lines
- `bindDistrictCanvas` delta in marker follow-up: -192 lines

## Block Location

- `bindDistrictCanvas`: `page-assets/js/app/runtime.js`, starts around line 9,746 after this pass.
- Main canvas renderer `renderDistrictCanvas` remains separate and was not moved.

## Subparts

A) Map boot/binding:
- Reads canvas, viewport, map phase host, canvas host, map stage/mount.
- Creates hover canvas and interaction overlay.
- Registers map phase, settings, world, police, alliance and bounty listeners.

B) Click/hover interactions:
- Pointer move/leave/down/up/cancel/click handlers remain in runtime.
- Hit testing through `getDistrictAtPoint` remains in runtime.
- Tooltip rendering now delegates to `map/mapTooltip.js`; hover state and scheduling remain in runtime.

C) Selected district state:
- `interactionState.selectedDistrictId` remains in runtime.
- `window.empireStreetsDistrictState` remains in runtime.

D) District tooltip UI:
- Moved tooltip DOM update, positioning and gossip list rendering to `page-assets/js/app/map/mapTooltip.js`.
- Runtime still decides which district is hovered and when tooltip updates.

E) District summary UI:
- Moved selected district summary rendering to `page-assets/js/app/ui/selectedDistrictSummary.js`.
- Moved read-only summary payload builder to `page-assets/js/app/map/districtViewModel.js`.

F) District action hub UI:
- Moved action hub button rendering to `page-assets/js/app/ui/districtActionHub.js`.
- Moved action hub read-only payload mapping to `page-assets/js/app/map/districtViewModel.js`.
- Runtime still handles action clicks through existing delegated listener and existing gameplay branches.

G) Building list/detail bridge:
- Building list rendering was already delegated to `ui/districtPanel.js`.
- Opening building detail, resolving building popup targets and selected district mutation remain in runtime.

H) Attack/spy/robbery/trap/defense UI bridge:
- Existing setup/confirm popup orchestration remains in runtime.
- New action hub renderer only renders buttons and invokes/no-ops callbacks.

I) Map overlay controls:
- Not moved in this pass. Overlay state and redraw timing are still tightly coupled to settings and render.

J) Gameplay state mutation:
- Attack, spy, robbery, trap, occupy, defense persistence and result scheduling remain in runtime.
- District capture/destroy/ownership mutation remains in runtime.
- Mission marker payload assembly for active spy/police/attack/occupy/robbery/trap map markers now delegates to `map/mapMissionMarkersViewModel.js`; storage reads and animation scheduling remain in runtime.

K) Server/API sync:
- Browser-local authority/session bridge and `window.empireStreetsDistrictState` remain in runtime.

## State Read/Mutation

Reads:
- `getResolvedWorldState`, `getResolvedSpyState`, `getResolvedSpyIntel`, `getResolvedDistrictPoliceActions`
- stored attack/robbery/occupy orders
- weapon inventories, gang state, production/building detail helpers
- settings and phase host dataset

Mutates:
- `interactionState`
- selected district id
- world state for trap/defense/ownership flows
- gang members, spy state, weapon inventory
- mission/order state
- DOM modal visibility and popup refresh timer

## DOM Expectations

Key required anchors:
- district canvas, viewport, map phase host and map canvas host
- district tooltip elements
- district popup title/type/owner/metrics/flags/buildings/actions
- attack, spy, robbery, trap, defense and occupy modal elements
- building action status panel

Missing anchors still fail gracefully where the previous runtime already guarded them.

## Public API Preserved

- `window.empireStreetsDistrictState`
- `window.EmpireRuntime`
- `window.EmpireRuntimeModules`
- Existing ESM exports including `bindDistrictCanvas`, `renderDistrictCanvas`, `openAttackPanel`, `openSpyPanel`, `completeAttackOrder`, `completeSpyMission`, `getDistrictOwnerLabel`, `getCurrentPlayerOwnedDistrictIds`.

## New Files

- `page-assets/js/app/map/districtViewModel.js`
- `page-assets/js/app/map/mapTooltip.js`
- `page-assets/js/app/ui/districtActionHub.js`
- `page-assets/js/app/ui/selectedDistrictSummary.js`
- `tests/unit/runtime-district-view-model.test.js`
- `tests/unit/runtime-map-tooltip.test.js`
- `tests/unit/runtime-district-action-hub.test.js`
- `tests/unit/runtime-selected-district-summary.test.js`
- `page-assets/js/app/map/mapMissionMarkersViewModel.js`
- `tests/unit/runtime-map-mission-markers-view-model.test.js`

## What Stayed High-Risk

- Main map renderer and owner redraw.
- Hit testing, pointer/click handlers and selected district mutation.
- `window.empireStreetsDistrictState` capture/destroy/selection bridge.
- Attack/spy/robbery/trap/defense calculations and persistence.
- Police raid/result interactions and server/local authority bridge.
- Overlay settings and redraw scheduling.
- Mission animation loop and timing.
- Mission/order storage reads and completion side effects.

## Verification

Targeted checks passed:

- `node --check page-assets/js/app/runtime.js`
- `node --check page-assets/js/app/map/districtViewModel.js`
- `node --check page-assets/js/app/map/mapTooltip.js`
- `node --check page-assets/js/app/ui/districtActionHub.js`
- `node --check page-assets/js/app/ui/selectedDistrictSummary.js`
- `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\unit\runtime-district-view-model.test.js tests\unit\runtime-map-tooltip.test.js tests\unit\runtime-district-action-hub.test.js tests\unit\runtime-selected-district-summary.test.js tests\unit\runtime-district-panel.test.js tests\unit\runtime-refactor-guard.test.js tests\unit\runtime-map-rendering.test.js`
- `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\unit\runtime-map-mission-markers-view-model.test.js tests\unit\runtime-map-rendering.test.js tests\unit\runtime-refactor-guard.test.js tests\unit\runtime-main-flow-smoke.test.js`

Full gate results are also tracked in `docs/audits/runtime-next-sprint.md`.

## Manual Checklist

1. Open game page.
2. Verify map renders.
3. Hover district and verify tooltip appears.
4. Click owned district and verify summary.
5. Click enemy district and verify attack/spy options.
6. Click unclaimed district and verify no crash.
7. Verify overlay/settings toggles still redraw.
8. Verify action buttons display correct enabled/disabled state.
9. Open buildings/detail from district popup.
10. Open attack and spy panels.
11. Verify map still reacts after selecting district.
12. Verify console has no fatal errors.

## Next Recommendation

Next safest step: extract only read-only attack/robbery/spy confirm modal text builders. Keep validation, cooldowns, storage, mission creation, district ownership and result scheduling in runtime.
