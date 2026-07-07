# Map Manifest

Empire Streets uses one authoritative city map manifest:

`packages/game-config/src/maps/empire-streets-city-map.json`

The manifest was extracted from the current visual canvas map in `pages/game.html`, rendered through `page-assets/js/app/map/mapGeometry.js` at `1600 x 980`. It contains 161 visible districts and preserves the clicked canvas numeric IDs as `legacyId`.

Canonical district IDs are strings in the form `district:<legacyId>`, for example `district:1`. Boundary helpers live in `packages/game-config/src/maps/empire-streets-city-map.ts`:

- `resolveCanonicalDistrictId(inputId)`
- `resolveLegacyDistrictId(canonicalId)`

Runtime and server internals should use only canonical IDs. Legacy numeric IDs are allowed only at browser/static-page boundaries.

To regenerate the browser asset from the manifest:

```sh
node scripts/generate-empire-city-map-assets.mjs
```

The generated client file is:

`page-assets/js/data/empire-city-map.generated.js`

Do not edit generated map assets by hand.

Spawn candidates are generated from the canonical manifest rule: non-Downtown districts in the first 5 map columns are `west` spawns, non-Downtown districts in the last 5 map columns are `east` spawns, and every non-Downtown district in the bottom row is a `south` spawn. On the current 7 x 23 city grid this yields 83 spawn candidates.
