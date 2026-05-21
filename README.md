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
- Playwright E2E also requires at least Node `18.19`; local Node `18.3.x` cannot run `npm run test:e2e`.
- After upgrading Node, run targeted E2E with `node scripts/run-local-bin.mjs playwright/cli.js test tests/e2e/entry-flow.spec.js`.

## Compatibility

- `packages/shared` and `packages/debug-tools` remain only as deprecated compatibility placeholders.
- Canonical shared contracts live in `packages/shared-types`.
- Canonical tooling packages live in `tools/debug` and `tools/seed`.
