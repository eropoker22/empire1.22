# Map Parity

Client and server share the same source map through `@empire/game-config`.

Server seed:

- `apps/server/src/bootstrap/gameplay-slice-shared-city-plan.ts` adapts `empireStreetsCityMapManifest`.
- `ensureSharedCityMap` creates `districtsById` from manifest districts.
- `adjacentDistrictIds` comes from manifest `neighborIds`.
- `zone`, `name`, and canonical `id` come from the manifest.

Client canvas:

- `page-assets/js/app/map/mapGeometry.js` reads `page-assets/js/data/empire-city-map.generated.js`.
- The generated asset is produced from the canonical manifest.
- Canvas keeps numeric `legacyId` compatibility but also carries `canonicalId`.

Hash parity:

- Canonical hash is exported as `empireStreetsCityMapManifestHash`.
- Generated client hash is `empireCityMapManifestHash`.
- Server read-model returns `mapManifestId`, `mapManifestVersion`, and `mapManifestHash`.
- Client command dispatch fails closed when server hash differs from local hash.

The parity test is `tests/unit/game-config/empire-city-map-manifest.test.ts`.
