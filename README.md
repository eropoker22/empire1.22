# Empire Streets

Empire Streets is a pre-alpha browser strategy game. The repository contains both the current static/local demo and server-authoritative core, transport, persistence, and read-model work. A production multiplayer deployment is not finished.

## Runtime Status

- The checked-in `pages/game.html` and Netlify static build explicitly run in `local-demo` mode.
- Local demo state is browser-local and is not production authority.
- `server-authoritative` mode exists for the gameplay slice and closed-alpha development, but it must be selected explicitly or backed by a ready server session.
- A requested server mode never falls back to local demo after a server/session failure.
- Production must fail closed without a production account identity provider and gameplay session repository.
- War mode is not ready for public play.

The execution boundary is centralized in `page-assets/js/app/runtime/gameplayExecutionMode.js`. It exposes only:

- `local-demo`
- `server-authoritative`
- `unavailable`

Demo-only city events, global demo chat, and local alliance previews run only in `local-demo`. They are disabled in server-authoritative mode.

## Gameplay Configuration

Typed balance in `packages/game-config` is canonical. The unbundled static client consumes the generated adapter `packages/game-config/src/legacy-page/gameplay-config.generated.js`; regenerate it with `npm run generate:browser-config`. The adapter contains no independently maintained balance.

The four production buildings use independent one-unit production lines:

- Pharmacy: Chemicals, Biomass, Stim Pack
- Drug Lab: Neon Dust, Pulse Shot, Velvet Smoke, Ghost Serum, Overdrive X
- Factory: Metal Parts, Tech Core, Combat Module
- Armory: five attack weapons and five defense items

Ghost Serum, Pulse Shot, Overdrive X, and Combat Module feed the three canonical strategic boost protocols. They are consumed only through the boost activation flow, never by direct item use. Combat Module also remains a strategic Factory output consumed by high-tier Armory recipes.

Strategic boost protocols are Ghost Network (intel), Industrial Overdrive (production), and Tactical Grid (the next valid PvP combat). Local demo persists their state through the local authority session; server-authoritative mode uses the typed command and player read model and never falls back to browser authority.

Global stock limits are per resource, not shared pools:

- Bulk: base 60 per item
- Tactical: base 24 per item
- Strategic: base 8 per item

Only the number of active owned Warehouses and the highest active owned Warehouse level increase those limits. Power Stations do not change global storage capacity.

## Architecture

- `apps/client` - player client package
- `apps/admin` - admin dashboard
- `apps/server` - authoritative runtime and transport
- `packages/shared-types` - shared contracts
- `packages/game-core` - pure rules and authoritative handlers
- `packages/game-config` - typed balance and content registries
- `page-assets` / `pages` - current static pre-alpha client
- `tools/debug` / `tools/seed` - simulations and seed tooling

Runtime renders. Core decides. Config balances. Server owns authority.

New server gameplay must not trust request `playerId` or `accountId`. Gameplay load and submit derive identity from a validated gameplay session; snapshot tokens restore state only and never authorize a request. Logout revokes the gameplay session.

## Local Development

The repository requires Node 20 or newer (`.node-version`, `.nvmrc`).

- `npm run dev:game` starts the game Vite server and local gameplay API middleware.
- `npm run dev:admin` starts the static/admin Vite flow only.
- `npm run generate:browser-config` refreshes the browser-safe generated balance adapter.
- `npm run check:browser-config` verifies that generated browser balance matches typed config.
- `npm run typecheck` runs the TypeScript project check.
- `npm run lint` runs architecture, command safety, file-size, and generated-config guards.
- `npm test` runs unit, integration, server, persistence, and read-model suites.
- `npm run test:simulation` runs the slower deterministic simulations.
- `npm run simulate:production-chain` runs the authoritative Pharmacy -> Drug Lab -> Factory -> Armory chain and writes its invariant report.
- `npm run test:e2e:smoke` runs the focused browser smoke suite.
- `npm run test:e2e:full` runs all Playwright scenarios.
- `npm run build:admin:page` prepares the Netlify publish output in ignored `client/`.
- `npm run verify:closed-alpha` runs the closed-alpha security and browser smoke gate.
- `npm run test:persistence:postgres:smoke` is opt-in and requires `EMPIRE_TEST_DATABASE_URL`.

Generated `client/` output is ignored. Source changes belong in root `pages/`, `page-assets/`, and typed packages.

## Further Reading

- [Architecture boundaries](docs/architecture-boundaries.md)
- [Gameplay session security](docs/gameplay-session-security.md)
- [Persistence](docs/persistence.md)
- [Production buildings](docs/production-buildings-functional-audit.md)
- [Production-chain simulation report](docs/balance/production-chain-simulation-report.md)
- [Pre-alpha readiness](docs/pre-alpha-gameplay-readiness.md)
- [Legacy runtime guard](docs/legacy-runtime-guard.md)
