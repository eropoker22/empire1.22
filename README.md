# Empire Streets

Project skeleton for a multiplayer browser strategy game with strict separation between UI, server runtime, shared contracts, game core, mode config, admin, and tooling.

## Structure

- `apps/client` - player-facing browser client
- `apps/admin` - admin dashboard shell
- `apps/server` - authoritative runtime and transport layer
- `packages/shared-types` - client/server contracts and shared primitive types
- `packages/game-core` - pure game rules and simulation logic
- `packages/game-config` - mode presets and content registries
- `tools/debug` - isolated debug tooling
- `tools/seed` - isolated seed/bootstrap tooling
- `docs/architecture` - architectural decisions and boundaries

## Rules

- No game logic in UI
- Server is the source of truth
- Free and war modes share one core and diverge through config
- Legacy `START` is an internal dev/setup sandbox only, not a production game phase
- Debug/demo tooling stays outside production runtime
- Keep modules small and feature boundaries explicit

## Architecture guardrails

See [docs/architecture-boundaries.md](docs/architecture-boundaries.md) for the main boundary rules between the legacy static frontend and the server-authoritative architecture.
See [docs/persistence.md](docs/persistence.md) for runtime persistence drivers and local durable file storage.

Runtime renders. Core decides. Config balances. Server owns authority.

New gameplay changes should not be implemented directly in legacy `page-assets/js/app/runtime.js`.

## Local Tooling

- The repo declares `node >=20` in `package.json`.
- Use Node 20 locally. `.node-version` and `.nvmrc` pin the expected major version for common version managers and CI.
- Playwright E2E also requires at least Node `18.19`; local Node `18.3.x` cannot run E2E commands.
- `npm run test:e2e` runs the fast browser smoke suite for login, lobby, and faction onboarding.
- `npm run test:e2e:full` runs every browser scenario, including slower map interaction coverage.
- Run targeted E2E with `node scripts/run-local-bin.mjs playwright/cli.js test tests/e2e/entry-flow.spec.js`.
- `npm test` is the regular development gate and excludes long-running balance/simulation suites.
- `npm run test:simulation` runs the slow deterministic balance and shared-city simulation tests.
- `npm run test:full` runs both the regular test gate and the simulation gate.

## Quality Gates

- GitHub Actions `Quality` runs on pushes and pull requests: lint, typecheck, `npm test`, `npm run build:admin:page`, and E2E smoke.
- GitHub Actions `Deep Checks` runs nightly and manually: simulation tests and full E2E.
- Generated browser/static artifacts under `page-assets` should be committed only when they are refreshed by the matching build or runtime change. Source changes and generated asset updates should stay in the same commit when the asset output depends on that source change.

## Compatibility

- `packages/shared` and `packages/debug-tools` remain only as deprecated compatibility placeholders.
- Canonical shared contracts live in `packages/shared-types`.
- Canonical tooling packages live in `tools/debug` and `tools/seed`.
