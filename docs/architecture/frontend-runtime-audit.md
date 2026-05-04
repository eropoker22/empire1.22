# Frontend Runtime Audit

## Production Static Frontend

- Source entrypoints: `pages/*.html`.
- Source assets: `page-assets/**` and `img/**`.
- Netlify publish output: generated `client/**`.
- Build path: `npm run build:admin:page` runs the admin slice bundle build and then `scripts/build-netlify-client.mjs`.
- `scripts/build-netlify-client.mjs` deletes `client/` and copies `pages`, `page-assets`, `img`, and the legacy browser-only package modules into the publish directory.

`client/` is not canonical source. It is ignored by git and can be stale until the publish build is rerun.

## Legacy / Demo Browser Runtime

- `page-assets/js/app/runtime.js` is the legacy static-page browser runtime.
- `page-assets/js/app/model/authority-state.js` stores preview-mode state in browser storage when no server-fed session exists.
- `packages/game-config/src/legacy-page/**` and `packages/game-core/src/legacy-page/**` are browser preview compatibility modules copied into `client/` because the static browser ESM imports them directly.
- `page-assets/js/admin-assets/admin-slice-demo.js` is a generated debug/admin demo bundle, not production gameplay authority.

These files remain because the current production static page still depends on the legacy shell. They should be migrated by slice, not deleted wholesale.

## Server-Authoritative Runtime

- `apps/server/src/runtime/**` is the authoritative instance runtime.
- `packages/game-core/src/**` is the authoritative rules layer.
- `packages/game-config/src/**` is the canonical mode and balance configuration layer.
- `apps/client/src/**` is the new thin client shell intended to render server-fed state and dispatch commands only.

At the time of this audit, `pages/game.html` still boots the legacy static runtime via `page-assets/js/app.js`; it does not boot `apps/client/src` as the production game entrypoint.

## Current Duplicate Map

- `pages/**` vs `client/pages/**`: `client/pages` is generated from `pages`.
- `page-assets/**` vs `client/page-assets/**`: `client/page-assets` is generated from `page-assets`.
- `packages/*/src/legacy-page/**` vs `client/packages/*/src/legacy-page/**`: generated browser compatibility copies.
- `page-assets/js/app/runtime.js` vs `apps/client/src/**`: not direct duplicates. The former is legacy static runtime; the latter is the target thin client architecture.

## Safe Migration Plan

- Keep as production now: `pages/**`, `page-assets/**`, `img/**`, `packages/game-config/src/**`, `packages/game-core/src/**`, `apps/server/src/**`.
- Keep as generated publish output: `client/**`.
- Keep as dev/demo: `tools/debug/**`, `page-assets/js/admin-assets/admin-slice-demo.js`, `page-assets/js/app/game-admin-slice-launcher.js`.
- Mark as deprecated legacy bridge: `page-assets/js/app/runtime.js`, `page-assets/js/app/model/authority-state.js`, `packages/*/src/legacy-page/**`.
- Later deletion candidates after slice migration: legacy browser mutation helpers in `runtime.js`, browser `legacy-page` package copies, and the hidden game-admin slice overlay inside `pages/game.html`.

## Known Risks

- `page-assets/js/app/runtime.js` still contains browser-side preview mutations for police, heat, production, attacks, spying, and inventory.
- `pages/game.html` still contains hidden debug/admin slice overlay markup, although the debug bundle is loaded lazily by query/localStorage guard.
- `apps/client/src` is structurally separated but not wired as the production `game.html` entrypoint.
- `client/` can differ from source after local edits until `npm run build:admin:page` is run.
