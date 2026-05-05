# Runtime Refactor Guard

Audit date: 2026-05-04

This guard exists before further `runtime.js` refactors. Its purpose is to preserve the legacy UI contract while the project moves toward server-authoritative gameplay.

## Canonical Runtime

Canonical source:

- `page-assets/js/app/runtime.js`
- helper modules under `page-assets/js/app/runtime/`

Generated publish output:

- `client/page-assets/js/app/runtime.js`
- `client/page-assets/js/app/runtime/*`

`scripts/build-netlify-client.mjs` deletes and rebuilds `client/` from root `pages/`, `page-assets/`, `img/`, and the explicit legacy compatibility package folders. Do not edit `client/` manually. Regenerate it only through `npm run build:admin:page` or `node scripts/build-netlify-client.mjs` when publish output is intentionally part of a change.

## Load Path

`pages/game.html` loads the runtime through module scripts:

- `pages/game.html`
- `<script type="module" src="../page-assets/js/app.js"></script>`
- `page-assets/js/app.js`
- `page-assets/js/app/render-ui.js`
- `page-assets/js/app/runtime.js`

The runtime is ESM, not a classic script. Do not convert it to a classic global script. Keep `runtime.js` as the legacy compatibility facade and preserve existing exported names until callers are migrated.

## Inline Handler Contract

Current HTML does not use inline `onclick`, `onchange`, or `oninput` handlers for the game runtime. UI behavior is bound by module code through `data-*` selectors.

Because there are no inline HTML handler globals, future refactors must preserve:

- ESM exports from `page-assets/js/app/runtime.js`
- re-exports from `page-assets/js/app/render-ui.js`
- `window` state objects listed below
- `data-*` selectors used by binders

Critical runtime exports used by the legacy UI facade include:

- `bootstrapPage`
- `PAGE_ROOT_SELECTOR`
- `bindDistrictCanvas`
- `bindPlayerProfilePopup`
- `bindBuildingActionStatus`
- `bindStoragePopup`
- `bindMarketPopup`
- `bindGangWantedStatus`
- `bindSpyMissions`
- `bindAttackOrders`
- `bindRobberyOrders`
- `bindArmoryPopup`
- `bindDrugLabPopup`
- `bindFactoryPopup`
- `bindPharmacyPopup`
- `showSpyToast`
- `showAttackToast`
- `showRobberyToast`

## Window Globals To Preserve

These globals are part of the current legacy bridge and must not be renamed or removed during low-risk extraction:

- `window.empireStreetsPage`
- `window.empireStreetsDistrictState`
- `window.empireStreetsAllianceState`
- `window.empireStreetsBountyState`
- `window.Empire`
- `window.Empire.Map`
- `window.Empire.openBountyModalShortcut`
- `window.EmpireAdminSliceDemo`
- `window.EmpireGameplaySliceClient`

Important browser storage keys:

- `empireStreets.session.v1`
- `empire_settings`
- `empireStreets.districtBuildingDetails.v1`
- `empireStreets.clinicRecoveryPool.v1`
- `empireStreets.cityEvents.v1`
- `empireStreets.bounty.v1`

## Critical DOM Contract

The game boot needs these roots and controls to stay addressable:

- `#game-root[data-page="game"]`
- `script[type="module"][src="../page-assets/js/app.js"]`
- `[data-mount-role="map"]`
- `[data-map-viewport]`
- `[data-map-canvas]`
- `[data-district-canvas]`
- `[data-player-profile-open]`
- `[data-player-popup]`
- `[data-player-popup-close]`
- `[data-buildings-popup-open]`
- `[data-buildings-popup]`
- `[data-buildings-popup-close]`
- `[data-buildings-popup-types]`
- `[data-buildings-popup-detail]`
- `[data-building-action-feed]`
- `[data-topbar-clean-money]`
- `[data-topbar-dirty-money]`
- `[data-topbar-influence]`
- `[data-storage-popup-open]`
- `[data-nav-settings]`
- `[data-nav-logout]`

## Automated Guard

Run:

```powershell
node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\unit\runtime-refactor-guard.test.js
```

The guard checks:

- `game.html` still loads `app.js` as an ESM module.
- Runtime is reached through `app.js -> render-ui.js -> runtime.js`.
- No game HTML inline `on*` handlers are introduced.
- Critical map/profile/building panel DOM markers exist.
- `render-ui.js` imports without console errors.
- Main runtime facade exports still exist.
- Source bindings for profile popup and building popup are still present.
- Required `window` bridge names are still present in source.

This is not a full browser E2E test. It is a fast refactor guard for accidental contract breaks. Use the manual checklist below before merging risky UI movement.

## Manual QA Checklist

Login:

1. Open `pages/login.html` through the local/static dev flow.
2. Register or enter as guest.
3. Confirm navigation reaches `lobby.html` without console errors.

Lobby:

1. Pick a free or war server.
2. Select a start district.
3. Continue to faction selection.
4. Confirm the selected district persists after faction lock.

Game boot:

1. Open `pages/game.html`.
2. Confirm `body.game-body--booting` is removed after boot.
3. Confirm topbar money, influence/spy pill, storage, settings, and logout controls are visible.
4. Confirm browser console has no red runtime exceptions.

Map:

1. Confirm the map canvas renders inside `[data-map-viewport]`.
2. Hover or tap a district and confirm the district popup can open.
3. Confirm owned districts still show player color fill.
4. Confirm map phase/border buttons do not throw console errors.

Profile Popup:

1. Click `Profil hráče`.
2. Confirm `[data-player-popup]` opens.
3. Confirm player name, faction, alliance, districts, clean money, dirty money, and heat render.
4. Click the close button and press `Escape`; the popup must close.

Building Panel:

1. Click `Budovy`.
2. Confirm `[data-buildings-popup]` opens centered.
3. Click district type buttons in the left list.
4. Confirm the detail panel renders building counts and cards.
5. Open at least one normal building and one special production building.
6. Close the modal with the `X` and `Escape`.

## Safe Next Refactor

The next safe step remains UI-only extraction:

- Extract `bindOverflowTextTooltips` into a small module.
- Keep its public name re-exported from `runtime.js` if needed.
- Do not touch attack, district ownership, server sync, building actions, police heat, market transactions, or persistence in that PR.
