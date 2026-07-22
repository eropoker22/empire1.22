# Production Authority Cutover

This document defines the closed-alpha authority boundary. The public product follows one rule:

> Production data, or an honest unavailable state. Never a silent mock fallback.

## Authority Matrix

| Environment | Account | Lobby | Gameplay | Fixtures |
| --- | --- | --- | --- | --- |
| Production | PostgreSQL account API and HttpOnly session | PostgreSQL/API | server-authoritative | forbidden |
| Staging | PostgreSQL account API and HttpOnly session | PostgreSQL/API | server-authoritative | forbidden |
| Local hosted development | PostgreSQL account API and HttpOnly session | PostgreSQL/API | server-authoritative | forbidden |
| Explicit local demo | local demo identity | local demo registry | local-demo | allowed on loopback only |
| Onboarding sandbox | real account context plus isolated sandbox | not applicable | onboarding-sandbox | onboarding fixtures only |
| Tests | fixtures | fixtures | fixtures | allowed in test boundaries |

The browser may cache presentation preferences. It must not derive account identity, membership, gameplay authority, rank, Empire Score, elimination, or match results from `localStorage` or `sessionStorage`.

## Fixture Inventory

The cutover inventory classified repository files containing mock/demo/fallback/fixture/runtime-mode terms. It is a conservative file-level keyword triage, not a count of individual runtime symbols.

| Category | Files | Production reachable | Action |
| --- | ---: | --- | --- |
| A. Production-reachable | 146 | yes or shared | remove seed authority; keep only honest loading/empty/error fallbacks |
| B. Local-demo only | 7 | no | keep behind loopback plus explicit opt-in |
| C. Onboarding sandbox | 6 | only through sandbox | keep isolated; block server commands |
| D. Test/tool fixture | 206 | no | keep for unit, integration, Playwright, and simulations |
| E. Documentation/example | 53 | no runtime authority | keep when current, update stale claims |
| F. Dead/unused | 0 confirmed | no | none removed solely by keyword matching |

Representative decisions:

| File or symbol | Category | Production action |
| --- | --- | --- |
| `page-assets/js/app/features/leaderboard.js` | A | render only the server leaderboard; no seed players |
| `page-assets/js/app/alliance-runtime.js` | A | consume server state; local fixtures are injected only by demo entry |
| `page-assets/js/app/runtime/marketState.js` | A | return an honest empty/unavailable state without installed demo data |
| `page-assets/js/app-demo.js` | B | install local fixture state only after the safe demo gate |
| `page-assets/js/app/dev-fixtures/` | B | never statically imported by the production graph |
| `page-assets/js/app/onboarding/demoScenarios.js` | C | used only by the onboarding/local demo boundary |
| `tests/`, `tools/debug/`, `tools/seed/` | D | fixtures remain available to verification and simulations |

Run `npm run check:production-fixture-boundary` after changing any live entrypoint or runtime import.

## Client Authority

- Public hosts ignore `?runtimeMode=local-demo`, clear the stale `empire:local-demo-session:v1` key, and continue through live entrypoints.
- Local demo requires both an exact loopback hostname and an explicit local opt-in.
- Login, lobby, faction setup, and game each select their live module on public hosts.
- A failed account, lobby, membership, worker, gameplay-session, or gameplay-slice request never changes execution mode to local demo.
- Before the first validated gameplay slice, live-looking values remain `—`, loading, or hidden and gameplay actions stay disabled.
- The onboarding sandbox is allowed to simulate actions locally, but `serverCommandAuthorityGuard.js` prevents those actions from submitting server commands.

## Public Account Registration

Account registration and registration for a hosted server are separate operations.

The public account flow uses:

- `POST /api/account/register`
- `POST /api/account/session`
- `GET /api/account/session`
- `DELETE /api/account/session`

The account registration modal collects:

- nick;
- gang name;
- date of birth;
- password;
- password confirmation.

There is no invite field and no invite authority. The API verifies matching passwords and the minimum age of 16 years. Age is evaluated against authoritative PostgreSQL UTC time inside the account-creation transaction.

The read-only registration policy exposes only whether registration is enabled, the open/closed mode, minimum password length, and minimum age. If policy loading fails, login remains available and registration fails closed.

The feature flag retains its historical name:

- `EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED`

When enabled in production, durable auth throttling also requires:

- `EMPIRE_AUTH_THROTTLE_PEPPER`

The throttle stores hashes of normalized account/network identifiers. It never stores a raw password, date of birth, cookie, or network address.

## Session And Request Security

Production requirements:

- `EMPIRE_PERSISTENCE_DRIVER=postgres`
- `GAMEPLAY_PERSISTENCE_DRIVER=postgres`
- `EMPIRE_DATABASE_URL`
- `GAMEPLAY_SLICE_SESSION_SECRET` with at least 32 characters
- `GAMEPLAY_SLICE_SNAPSHOT_SECRET` with at least 32 different characters
- `EMPIRE_ALLOWED_ORIGINS` containing only explicit HTTPS origins
- `EMPIRE_AUTH_THROTTLE_PEPPER` with at least 32 characters while public registration is enabled

Account cookies are HttpOnly, `SameSite=Strict`, scoped to `/`, and `Secure` in production. State-changing account, lobby, entry, and gameplay routes use the existing Origin/CSRF guard. `playerId`, `accountId`, and snapshot tokens are never accepted as identity proof.

## Hosted Server Registration

Registration for a specific Free server remains a server-authoritative interval of exactly 60 minutes. The browser displays the countdown but does not decide eligibility.

- a hosted server can start with two fully active and prepared players;
- the normal capacity remains canonical and is not reduced to two;
- starting the server does not close registration;
- new players may enter a running server until the stored close instant;
- a membership accepted before close may finish faction/avatar/color setup afterward;
- the join endpoint rejects new memberships at the close boundary;
- low-player Final Lockdown and Očista protections remain server-specific and durable.

## Live Panels And Results

- Leaderboard and player Empire Score render server-provided values only.
- Unknown values display `—`, not a fabricated zero.
- Očista consumes the elimination read model; control servers report that Očista is disabled.
- Final Lockdown consumes its server read model and never fabricates a Top 3.
- Completed match results, final rank, score, and score breakdown are durable in PostgreSQL and remain readable to former participants.
- Match completion uses the authoritative clock, never the Unix epoch placeholder.

## Admin Diagnostics

The admin control-plane panel displays:

- frontend build SHA injected during the static build;
- API build SHA from `EMPIRE_BUILD_SHA`;
- worker build SHA from the durable worker heartbeat;
- expected schema version from the production migration contract.

The panel warns when a SHA is missing or the three deployed components differ. These diagnostics are admin-only.

## Preflight

Code-level verification:

```text
npm run check:production-fixture-boundary
npm run verify:production-authority-cutover
```

Strict production preflight additionally requires real environment variables:

```text
NODE_ENV=production
EMPIRE_PRODUCTION_AUTHORITY_PREFLIGHT_STRICT=1
```

Then run `npm run verify:production-authority-cutover`. It fails closed when PostgreSQL drivers, database URL, secure origin allowlist, secrets, worker identity, or auth throttle configuration are missing.

## Deployment Order

1. Create and verify a PostgreSQL backup.
2. Deploy migrations and confirm the schema is current.
3. Deploy API/functions from one commit SHA.
4. Deploy the hosted worker from the same SHA.
5. Verify the fresh durable worker heartbeat.
6. Deploy the frontend with the same `EMPIRE_BUILD_SHA`.
7. Open admin diagnostics and confirm frontend/API/worker SHA plus schema.
8. Run `npm run verify:production-authority-cutover` in strict mode.
9. Enable public account registration with `EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED=true`.
10. Create a control server and run the registration smoke below.

No step in this document automatically deploys or changes hosting state.

## First Registration Smoke

1. Open production login without demo parameters.
2. Open the separate red registration modal.
3. Verify under-16 registration is rejected.
4. Create an eligible account with matching passwords.
5. Confirm the HttpOnly session and live lobby profile.
6. Confirm only real hosted servers are listed.
7. Select an open server and reserve a real district.
8. Complete faction, avatar, and color setup.
9. Wait for worker activation and enter the live game.
10. Refresh with empty browser storage and confirm the same account, membership, and server state return.
11. Repeat with a second browser/account and verify both clients observe server-authoritative changes.

## Rollback

Never enable public local demo as disaster recovery.

1. Set `EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED=false`.
2. Close hosted-server registrations and stop provisioning new servers.
3. Preserve PostgreSQL data, snapshots, memberships, and results.
4. Roll frontend, API, and worker back to one mutually compatible SHA.
5. Confirm migrations remain compatible with that release.
6. Verify worker heartbeat and admin diagnostics.
7. Run the strict production-authority preflight again before reopening registration.

## Honest Failure States

Production UI may show loading, empty, unavailable, unauthorized, or reconnecting. It must never replace missing live data with a fictional player, server, alliance, market, Očista countdown, Final Lockdown result, or Empire Score.
