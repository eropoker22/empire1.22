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
See [docs/admin-dashboard.md](docs/admin-dashboard.md) for the closed-alpha read-only admin dashboard.
See [docs/prod-like-smoke.md](docs/prod-like-smoke.md) for the opt-in live Postgres closed-alpha smoke.

Runtime renders. Core decides. Config balances. Server owns authority.

New gameplay changes should not be implemented directly in legacy `page-assets/js/app/runtime.js`.

## Local Tooling

- The repo declares `node >=20` in `package.json`.
- Use Node 20 locally. `.node-version` and `.nvmrc` pin the expected major version for common version managers and CI.
- `npm run dev:game` is the normal local server-authoritative game command. It starts Vite on `127.0.0.1:5174` with the local gameplay API middleware wired to the same Netlify gameplay-slice handler used in production.
- `npm run dev:admin` starts only the static/admin Vite flow. It does not by itself provide `/api/gameplay-slice/*` or `/api/admin/monitoring`.
- `http://127.0.0.1:5174/admin` is the local closed-alpha read-only admin dashboard when `npm run dev:game` is running.
- Production admin monitoring is guarded by `EMPIRE_ADMIN_SECRET` over the `x-empire-admin-secret` header and fails closed when the secret is missing or wrong.
- The active browser runtime is exposed as `document.body.dataset.gameplayRuntime`: `demo-ready`, `server-authoritative-ready`, `server-authoritative-error`, `legacy-fallback`, or `initializing`. `document.body.dataset.gameplayServerRuntime` records the server-authoritative attempt separately.
- `npm run smoke:ui:legacy` checks static legacy page wiring only; it does not verify server-authoritative gameplay.
- `npm run smoke:free-session` is the Netlify demo/development smoke. It expects `demo-ready`, allows localStorage/demo fallback, and still fails on runtime crashes or broken demo UI.
- `npm run smoke:free-session:server` is the closed-alpha server smoke variant and expects `server-authoritative-ready`.
- `npm run smoke:gameplay-slice` starts the local game dev server and skips with `server not connected yet` when a real gameplay session is not available.
- `npm run smoke:gameplay-slice:server` is strict: it requires `/api/gameplay-slice/load` and `/submit` to return server-authoritative read models and fails on demo/legacy fallback.
- Relevant dev, browser smoke, E2E, build, lint, and typecheck scripts run a Node 20 preflight and fail immediately on older Node versions.
- `npm run test:e2e` runs the fast browser smoke suite for login, lobby, and faction onboarding.
- `npm run test:e2e:full` runs every browser scenario, including slower map interaction coverage.
- `npm run verify:closed-alpha` is the canonical closed-alpha gate: typecheck, architecture/file-size lint, targeted session security + atomic persistence + authoritative actions + map manifest tests, and the Free-flow browser smoke suite.
- `npm run test:persistence:postgres:smoke` runs the opt-in live Postgres production-like smoke against `EMPIRE_TEST_DATABASE_URL` only.
- `npm run verify:prod-like` runs `verify:closed-alpha` and then the opt-in live Postgres smoke.
- `npm run verify:closed-alpha` keeps the file-size guard enabled. Existing oversized modules are tolerated only through explicit debt budgets in `scripts/check-file-sizes.mjs`, and those budgets are hard caps, not targets.
- Run targeted E2E with `node scripts/run-local-bin.mjs playwright/cli.js test tests/e2e/entry-flow.spec.js`.
- `npm test` is the regular development gate and excludes long-running balance/simulation suites.
- `npm run test:simulation` runs the slow deterministic balance and shared-city simulation tests.
- `npm run test:full` runs both the regular test gate and the simulation gate.
- `npm run verify:closed-alpha` intentionally does not run full Playwright, balance simulations, or live Postgres persistence checks. Those remain separate gates.
- Closed-alpha gate tolerates existing large modules only through explicit debt budgets. These budgets are caps, not targets. New or growing large modules must be split after closed alpha refactors are scheduled.

## Quality Gates

- GitHub Actions `Quality` runs on pushes and pull requests: lint, typecheck, `npm test`, `npm run build:admin:page`, and E2E smoke.
- GitHub Actions `Deep Checks` runs nightly and manually: simulation tests and full E2E.
- Generated browser/static artifacts under `page-assets` should be committed only when they are refreshed by the matching build or runtime change. Source changes and generated asset updates should stay in the same commit when the asset output depends on that source change.

## Compatibility

- `packages/shared` and `packages/debug-tools` remain only as deprecated compatibility placeholders.
- Canonical shared contracts live in `packages/shared-types`.
- Canonical tooling packages live in `tools/debug` and `tools/seed`.
