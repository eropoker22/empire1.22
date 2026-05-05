# Map UI Shell Refactor Audit

Date: 2026-05-05

## Canonical Source

- Canonical runtime: `page-assets/js/app/runtime.js`
- Generated runtime copy: `client/page-assets/js/app/runtime.js`
- Rule followed: `client/` was not edited by hand; regenerate it through the page build when publishing.

## Size

- Runtime baseline from current Git `HEAD`: 17,012 lines
- Runtime after this map shell pass in the working tree: 14,596 lines
- Runtime delta against current Git baseline: -2,416 lines
- Last audited `bindDistrictCanvas` size before this shell pass: 3,100 lines
- Current `bindDistrictCanvas` block size: 3,091 lines
- `bindDistrictCanvas` delta in this shell pass: -9 lines

Note: this checkout already contains earlier uncommitted runtime refactors. The Git `HEAD` baseline is the stable measurable baseline for the current working tree; the per-block `bindDistrictCanvas` delta is measured against the previous map audit.

Map status view-model follow-up:

- Runtime after status view-model follow-up: 14,621 lines
- Runtime delta against current Git baseline after status view-model follow-up: -2,391 lines
- `bindDistrictCanvas` after status view-model follow-up: 3,111 lines
- This follow-up intentionally added a small amount of runtime orchestration so status data is built lazily after redraw; gameplay, redraw, pointer handlers and action dispatch stayed unchanged.

Map tooltip view-model follow-up:

- Runtime after tooltip view-model follow-up: 14,617 lines
- Runtime delta against current Git baseline after tooltip view-model follow-up: -2,395 lines
- `bindDistrictCanvas` after tooltip view-model follow-up: 3,103 lines
- `bindDistrictCanvas` delta in tooltip view-model follow-up: -8 lines

District popup flags view-model follow-up:

- Runtime after popup flags view-model follow-up: 14,599 lines
- Runtime delta against current Git baseline after popup flags view-model follow-up: -2,413 lines
- `bindDistrictCanvas` after popup flags view-model follow-up: 3,081 lines
- `bindDistrictCanvas` delta in popup flags view-model follow-up: -22 lines

## Current Map Layer

- Main map renderer: `renderDistrictCanvas` in `page-assets/js/app/runtime.js`.
- Main interaction block: `bindDistrictCanvas` in `page-assets/js/app/runtime.js`.
- Existing map modules before/around this pass:
  - `page-assets/js/app/map/mapConstants.js`
  - `page-assets/js/app/map/mapDataAdapter.js`
  - `page-assets/js/app/map/mapGeometry.js`
  - `page-assets/js/app/map/districtViewModel.js`
  - `page-assets/js/app/map/mapTooltip.js`
  - `page-assets/js/app/map/mapMissionMarkersViewModel.js`
- New map UI shell modules from this pass:
  - `page-assets/js/app/map/mapShell.js`
  - `page-assets/js/app/map/mapOverlayState.js`
  - `page-assets/js/app/map/mapOverlayControls.js`
  - `page-assets/js/app/map/mapStatusPanel.js`
  - `page-assets/js/app/map/mapRefreshPipeline.js`
  - `page-assets/js/app/map/mapStatusViewModel.js`
  - `page-assets/js/app/map/mapTooltipViewModel.js`
  - `page-assets/js/app/map/districtPopupFlagsViewModel.js`

## Layer Split

A) Map boot:
- Runtime still calls `bindDistrictCanvas` and owns lifecycle order.
- `mapShell.js` now handles safe DOM lookup for map shell anchors and shell fallback state.

B) Map renderer:
- `renderDistrictCanvas` remains in runtime.
- District drawing, colors, geometry use and ownership rendering were not changed.

C) Map geometry:
- Existing geometry/data adapter modules remain responsible for read-only geometry helpers.
- No geometry mutation moved in this pass.

D) Map interaction binding:
- Pointer/click/hover handlers remain in runtime.
- Hit testing and selected district mutation remain in runtime.

E) Selected district mutation:
- Runtime still owns `interactionState.selectedDistrictId` and `window.empireStreetsDistrictState`.
- `districtPopupFlagsViewModel.js` builds the selected district popup flag payload from read-only inputs.

F) Overlay state:
- `mapOverlayState.js` provides a tiny immutable UI state adapter for overlay buttons.
- It does not calculate heat, influence, ownership or trap values.

G) Overlay controls UI:
- `mapOverlayControls.js` renders/update-only overlay controls and invokes callbacks supplied by runtime.
- Runtime still decides when any overlay causes redraw.

H) Map legend UI:
- No separate legend renderer was moved in this pass because no isolated legend block was present in canonical runtime.

I) Map status UI:
- `mapStatusPanel.js` renders read-only district counts, selected district label, overlay label and busy/error messages.
- It does not read or mutate gameplay state.

J) Tooltip UI:
- Existing `mapTooltip.js` still owns tooltip rendering/position/hide.
- `mapTooltipViewModel.js` now builds the read-only id/type/gossip payload.
- Hover decisions remain in runtime.

K) Map refresh pipeline:
- `mapRefreshPipeline.js` centralizes safe UI refresh order: redraw callback, shell visual sync, overlay UI, selected district UI and status UI.
- It does not redraw by itself unless runtime passes `redrawMap`.
- `mapStatusViewModel.js` builds district count, owned count, enemy count, selected district label and active overlay label from read-only inputs.

L) Gameplay action bridge:
- Attack/spy/robbery/trap/defense action dispatch stays in runtime.
- Server/local authority sync and action result handling stay in runtime.

## What Moved

- Map shell DOM lookup for canvas, phase host, viewport, canvas host, map stage/mount and tooltip anchors.
- Interaction overlay and hover canvas creation.
- Map shell missing/busy/error state helpers.
- Focus/hover shell class synchronization and overlay focus point helper.
- Read-only overlay UI state normalization/toggle helpers.
- Overlay controls render/update callback bridge.
- Map status panel rendering helpers.
- Refresh pipeline wrapper that delegates to runtime callbacks and UI modules.
- Map status read-only view-model builder for counts and labels.
- Map hover tooltip read-only payload builder.
- Selected district popup flag read-only payload builder.

## What Stayed In Runtime

- Main map drawing algorithm and district canvas rendering.
- Map geometry usage, district hit testing and pointer event handling.
- Selected district state mutation.
- Ownership, capture/destroy and district action side effects.
- Attack/spy/robbery/trap/defense calculations, storage, mission scheduling and result handling.
- Heat/influence/police calculations and redraw timing.
- Server/local sync bridge.

## Public API Preserved

Important compatibility paths remain:

- `window.EmpireRuntime`
- `window.EmpireRuntimeModules`
- `window.empireStreetsDistrictState`
- `window.EmpireRuntimeModules.mapStatusViewModel`
- `window.EmpireRuntimeModules.mapTooltipViewModel`
- `window.EmpireRuntimeModules.districtPopupFlagsViewModel`
- Existing runtime exports including `bindDistrictCanvas`, `renderDistrictCanvas`, `openAttackPanel`, `openSpyPanel`, `completeAttackOrder`, `completeSpyMission`, `runBuildingAction`, `collectProduction` and existing gameplay helpers.

No existing `window.toggleHeatmap`, `window.toggleInfluenceOverlay` or `window.toggleOwnershipOverlay` handler was found in canonical runtime, so no new gameplay toggle global was invented. Overlay helper APIs are exposed through `window.EmpireRuntimeModules`.

## Tests

Passed:

- `node --check page-assets/js/app/runtime.js`
- `node --check page-assets/js/app/map/mapShell.js`
- `node --check page-assets/js/app/map/mapOverlayState.js`
- `node --check page-assets/js/app/map/mapOverlayControls.js`
- `node --check page-assets/js/app/map/mapStatusPanel.js`
- `node --check page-assets/js/app/map/mapRefreshPipeline.js`
- `node --check page-assets/js/app/map/mapStatusViewModel.js`
- `node --check page-assets/js/app/map/mapTooltipViewModel.js`
- `node --check page-assets/js/app/map/districtPopupFlagsViewModel.js`
- `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\unit\runtime-map-shell.test.js tests\unit\runtime-map-overlay-controls.test.js tests\unit\runtime-map-status-panel.test.js tests\unit\runtime-map-refresh-pipeline.test.js`
- `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\unit\runtime-map-status-view-model.test.js tests\unit\runtime-map-refresh-pipeline.test.js tests\unit\runtime-map-shell.test.js tests\unit\runtime-refactor-guard.test.js`
- `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\unit\runtime-map-tooltip-view-model.test.js tests\unit\runtime-map-tooltip.test.js tests\unit\runtime-refactor-guard.test.js`
- `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\unit\runtime-district-popup-flags-view-model.test.js tests\unit\runtime-refactor-guard.test.js`
- `npm run typecheck`
- `npm run lint:architecture`
- `npm run lint:file-sizes`
- `npm run smoke:ui`
- `npm run test:unit`

Full unit result after the latest follow-up: 57 files, 229 tests passed.

## Known Risks

- `bindDistrictCanvas` is still the highest-risk block because it owns interaction state, gameplay action bridges and modal refresh order.
- `renderDistrictCanvas` still owns core drawing and should not be moved without visual/browser coverage.
- Overlay controls are ready as UI helpers, but canonical runtime did not have isolated public overlay toggle globals to delegate in this pass.
- `client/` remains stale until regenerated by build output.

## Manual Checklist

1. Open game page.
2. Verify map renders.
3. Click owned district.
4. Click enemy district.
5. Hover district and verify tooltip.
6. Toggle heatmap overlay if available in the page UI.
7. Toggle influence overlay if available in the page UI.
8. Toggle ownership overlay if available in the page UI.
9. Verify selected district summary.
10. Verify district action hub.
11. Verify UI refresh after attack/spy result.
12. Verify UI refresh after collect/building action.
13. Verify one click causes one response, not duplicate reactions.
14. Verify console has no fatal errors.

## Next Safest Step

Extract a read-only map status view-model builder that derives district counts, selected district label and active overlay label from existing runtime state. Keep redraw, pointer handlers and all action dispatch in runtime.
