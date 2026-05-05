# Building Change Guard

Datum: 2026-05-05

## Canonical Source

`client/` je generated publish output. Nové budovy, mazání budov a balance změny se dělají jen v canonical source:

- `packages/game-config/src/public/building-definitions.ts`
- `packages/game-config/src/public/building-name-variants.ts`
- `packages/game-config/src/public/district-building-sets.ts`
- `packages/game-config/src/base/base-fixed-buildings-config.ts`
- `packages/game-config/src/base/base-building-actions-config.ts`
- `packages/game-config/src/modes/free/free-mode.override.ts`
- `packages/game-core/src/handlers/*`
- `packages/game-core/src/projections/*`
- `packages/game-core/src/rules/*`
- `page-assets/js/app/runtime.js` and extracted root `page-assets/js/app/**` modules for legacy UI only
- `tests/**`

## Guard Rules

Before adding or changing a building:

1. Add or update the public building definition and name variants.
2. Add it to district building sets only by canonical `buildingTypeId`.
3. Add free-mode override config only when the building needs mode-specific pacing or special mechanics.
4. Add core handler/projection tests for non-passive mechanics.
5. Keep legacy UI rendering compatible, but do not move gameplay math into UI.
6. Do not edit generated `client/` files manually.
7. Keep removed buildings out of canonical source: `data_center`, `brainwash_center`, `taxi_service`.

## Required Checks

Run at minimum:

- `npm run typecheck`
- `npm run smoke:ui`
- `npm run lint:architecture`
- `npm run lint:file-sizes`
- relevant unit/integration tests
- `npm run test` before a push/commit gate

## Current Guard Test

`tests/unit/building-change-guard.test.js` protects the lightweight invariants:

- every district building set references a public building definition;
- every public building has display name variants;
- removed building IDs are absent from canonical source files;
- recent free-mode buildings keep targeted integration coverage markers.

This is not a replacement for focused behavior tests. It is a cheap tripwire before runtime/UI or config drift gets merged.
