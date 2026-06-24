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

`pages/game.html` still boots the legacy static runtime via `page-assets/js/app.js`, and also mounts the server-fed gameplay slice bundle at `[data-gameplay-slice-client]`. The slice reads `/api/gameplay-slice/load` and dispatches migrated surface commands through `/api/gameplay-slice/submit`.

## Local Dev Flow

- `npm run dev:admin` is plain Vite. It serves the static pages but does not provide Netlify redirects or `/api/gameplay-slice/*`, so the server-fed slice reaches `server-authoritative-error` and the page continues through the legacy fallback.
- `npm run dev:game` is the recommended local gameplay command. It uses `vite.game.config.ts`, which mounts a Vite middleware over the production `createGameplaySliceFunctionHandler()` from `apps/server/src/netlify/gameplay-slice-function.ts`.
- The local middleware handles `/api/gameplay-slice/*`, `/api/servers`, `/api/matchmaking/reserve`, and `/api/admin/monitoring` through the same server app composition used by the Netlify function. It is an adapter, not a duplicate gameplay implementation.
- The active browser runtime is machine-readable through `document.body.dataset.gameplayRuntime` and the slice root `data-gameplay-runtime`.

Runtime markers:

- `initializing`: the slice has a valid bootstrap request and is loading `/api/gameplay-slice/load`.
- `server-authoritative-ready`: the server-fed read model loaded and the slice is visible.
- `server-authoritative-error`: the slice attempted to load but the endpoint/network/response failed; local diagnostics show the endpoint and sanitized error while legacy remains active.
- `legacy-fallback`: no server-fed bootstrap request exists.

## Smoke Commands

- `npm run smoke:ui:legacy`: static legacy page wiring only.
- `npm run smoke:free-session`: browser free-session UX pass against the local game URL; it seeds session before navigation and expects `server-authoritative-ready` by default.
- `npm run smoke:gameplay-slice`: self-contained server-authoritative smoke. It starts `vite.game.config.ts`, verifies `/api/gameplay-slice/load`, submits one enabled server-fed building action, spy action, and attack action, verifies the returned read models, confirms non-success spy results do not unlock occupy, and fails on legacy-only fallback or legacy mutation events.
- `npm run test:e2e:smoke`: Playwright smoke; its web server now uses `vite.game.config.ts`, so API routes are present during browser flow tests.

## Migrated Gameplay Slice Actions

The current server-fed client surface owns these command paths when clicked inside `[data-gameplay-slice-client]`:

- fixed building action: `run-building-action`
- production collection: `collect-production`
- item processing: `craft-item`
- district spy from the server-fed district panel: `spy-district`
- district attack from an enabled server-fed attack target: `attack-district`
- district occupy from an enabled server-fed occupy target: `occupy-district`
- trap placement from the server-fed district panel: `place-trap`

Broader police UX and legacy conflict surfaces outside the slice still exist. Attack and spy clicks inside `[data-gameplay-slice-client]` dispatch through `/api/gameplay-slice/submit`; they must not emit legacy mutation events such as `empire:attack-started` or `empire:spy-started`.

`spy-district` now uses a server-side parity v2 model: the server resolves `success`, `partial`, `failed`, and `critical_failed`; only `success` unlocks occupy; `partial` reveals limited intel; `failed` and `critical_failed` keep a blocked spy slot in authoritative cooldown state. The model is still synchronous at command submit time because the authoritative write model does not yet have durable pending spy mission entities or a worker/lease completion path.

The migrated action owner is the server-fed slice button plus `apps/client/src/app/client-surface-actions.ts`; legacy build-slot hooks are intentionally ignored there. The legacy runtime may still render the rest of the game shell, but it must not replay the same server-fed button mutation.

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

- `page-assets/js/app/runtime.js` still contains browser-side preview mutations for police, heat, production, attacks, legacy spy fallback, and inventory. When `[data-gameplay-slice-client]` reaches `server-authoritative-ready`, server-fed spy and attack buttons dispatch through `/api/gameplay-slice/submit` and must not emit legacy mutation events such as `empire:spy-started` or `empire:attack-started`. True async pending spy missions remain a future server feature; parity v2 intentionally avoids adding a browser timer or worker lease.
- `pages/game.html` still contains hidden debug/admin slice overlay markup, although the debug bundle is loaded lazily by query/localStorage guard.
- `apps/client/src` is structurally separated and mounted as a gameplay slice, not yet as the full production `game.html` entrypoint.
- `client/` can differ from source after local edits until `npm run build:admin:page` is run.
