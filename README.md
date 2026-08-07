# Empire Streets

Empire Streets is a browser strategy game with a server-authoritative closed-alpha runtime. The repository also keeps an explicit loopback-only local UI demo, isolated onboarding sandbox, simulations, and test fixtures. None of those development layers is a production fallback.

## Runtime Status

- Public and staging builds always use the live account, lobby, membership, and gameplay APIs.
- Local demo is browser-local, requires a loopback hostname plus an explicit opt-in, and is never production authority.
- Onboarding uses a separate sandbox and reloads the authoritative gameplay slice after it ends.
- Server-authoritative failures remain loading, reconnecting, unavailable, or unauthorized states; they never switch to demo data.
- Production must fail closed without a production account identity provider and gameplay session repository.
- War mode is not ready for public play.

The client authority boundary is centralized in `page-assets/js/app/runtime/clientAuthorityState.js` and `page-assets/js/app/runtime/gameplayExecutionMode.js`. It distinguishes:

- `local-demo`
- `server-authoritative`
- `onboarding-sandbox`

Demo-only city events, global demo chat, and local alliance previews run only in explicit local demo. Production modules cannot statically import development fixtures; verify the boundary with `npm run check:production-fixture-boundary`.

## Accounts And Server Entry

Public account registration is controlled by the existing `EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED` feature flag. It does not use invitation codes. A new player supplies a nick, gang name, date of birth, password, password confirmation, and explicit acceptance of the server-advertised `EMPIRE_ACCOUNT_TERMS_VERSION`; PostgreSQL time enforces a minimum age of 16 years. Authentication uses an HttpOnly cookie and durable PostgreSQL throttling.

Registration for a specific hosted Free server is a separate one-hour window. A server can start with two fully prepared players, can continue accepting new players while the window remains open, and never treats browser time as authority.

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

The repository supports exactly Node.js 24 LTS (`.node-version`, `.nvmrc`, and `engines.node`).
Node 20, 22, 26, and unverified future major versions are rejected by the runtime guard.

Verify the active toolchain before installing dependencies:

```powershell
node --version
npm --version
```

On Windows, switch with nvm-windows, fnm, or Volta to major 24. On Unix/macOS,
run `nvm use` or `fnm use` so the repository version files select Node 24.

- `npm run dev:game` starts the game Vite server and local gameplay API middleware.
- `npm run dev:admin` starts the static/admin Vite flow only.
- `npm run generate:browser-config` refreshes the browser-safe generated balance adapter.
- `npm run check:browser-config` verifies that generated browser balance matches typed config.
- `npm run typecheck` runs the TypeScript project check.
- `npm run lint` runs architecture, command safety, file-size, and generated-config guards.
- `npm test` runs unit, integration, server, persistence, and read-model suites.
- `npm run test:simulation` runs the slower deterministic simulations.
- `npm run simulate:production-chain` runs the authoritative Pharmacy -> Drug Lab -> Factory -> Armory chain and writes its invariant report.
- `npm run test:e2e:smoke` runs the focused public live-entry browser smoke with deterministic API responses. Guest/local-demo gameplay and onboarding fixtures are intentionally excluded; real gameplay flows belong to Hosted Acceptance and staging acceptance.
- `npm run test:e2e:full` enumerates the development Playwright inventory, including legacy fixture scenarios; it is not a public release gate until those scenarios are migrated or retired.
- `npm run build:admin:page` prepares the Netlify publish output in ignored `client/`.
- `npm run verify:closed-alpha` runs the closed-alpha security and browser smoke gate.
- `npm run verify:production-authority-cutover` checks public-host demo lockout, production fixture imports, live entrypoints, registration authority, and cookie requirements.
- `npm run verify:pre-alpha:staging -- --plan` prints the canonical pre-alpha gate; remote staging phases require an explicit `--staging` flag and exact target guards.
- `npm run test:persistence:postgres:smoke` is opt-in and requires `EMPIRE_TEST_DATABASE_URL`.
- `npm run test:persistence:postgres:live` runs the complete opt-in live Postgres persistence suite; default `test:persistence` and coverage exclude it.

Current verified release truth and the staging playtest procedure live in
[`docs/release/current-pre-alpha-readiness.md`](docs/release/current-pre-alpha-readiness.md)
and [`docs/release/pre-alpha-tester-runbook.md`](docs/release/pre-alpha-tester-runbook.md).

Generated `client/` output is ignored. Source changes belong in root `pages/`, `page-assets/`, and typed packages.

## Further Reading

- [Architecture boundaries](docs/architecture-boundaries.md)
- [Gameplay session security](docs/gameplay-session-security.md)
- [Persistence](docs/persistence.md)
- [Production buildings](docs/production-buildings-functional-audit.md)
- [Production-chain simulation report](docs/balance/production-chain-simulation-report.md)
- [Pre-alpha readiness](docs/pre-alpha-gameplay-readiness.md)
- [Legacy runtime guard](docs/legacy-runtime-guard.md)
- [Production authority cutover](docs/production-authority-cutover.md)
