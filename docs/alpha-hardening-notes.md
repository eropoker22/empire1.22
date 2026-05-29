# Current Alpha Hardening Notes

## Current Alpha-Safe Areas

- Server/game-core remains the authority for gameplay decisions.
- Client and legacy render helpers must escape server-fed/user-controlled text before assigning HTML.
- The game page does not eagerly load the generated admin slice bundle; it is injected only through explicit debug opt-in.
- Postgres persistence has repository-level command log idempotence, command reservation before gameplay dispatch, snapshot latest root-version guard, and a distributed tick lock.

## Must Before Public Alpha

- Apply `002_command_reservations.sql` in production and keep Postgres persistence enabled for public multiplayer submit.
- Add stale pending command reservation recovery and full latest-snapshot/state serialization before high-traffic public launch.
- Run the release gate under Node 20 and keep E2E smoke green.

## Can Wait After Closed Alpha

- Dedicated player registration/session reservation repository can wait for closed alpha if closed alpha traffic stays low and serverless scale-out joins are not enabled.
- Broader legacy UI cleanup can wait if the known server-fed/user-controlled HTML paths stay covered by escape helpers.
- Live fanout/websocket delivery can wait; the UI must not promise real-time multiplayer until it exists.

## Known Production/Serverless Risks

- The live update gateway is a transport boundary for future fanout; current gameplay UI should describe this as server sync or refresh-after-action, not real-time multiplayer.
- `empire_player_registrations` exists in schema, but player registration/session reservation is not yet backed by a dedicated repository.
- Serverless cold restore can still depend on snapshot-token flow until database-backed session orchestration is complete.
- `empire_command_log` is idempotent, but idempotent append happens after the synchronous in-process pre-dispatch gate. See `docs/command-reservation-design.md` for the required async implementation plan.

## Required Commands Before Release

Run with Node 20:

```powershell
npm ci
npm run lint
npm run typecheck
npm test
npm run build:client:page
npm run build:admin:page
npm run smoke:ui
npm run test:simulation
npm run test:e2e:smoke
npm run coverage:check
npm run quality
```

## Node Version Requirement

The repository requires Node 20. Local verification in the current hardening follow-up saw `node -v` return `v18.3.0`, with `.node-version` and `.nvmrc` both set to `20`. E2E smoke is not validly verified until Node 20 is active.

Use the repo version files when a version manager is available:

```powershell
nvm install 20
nvm use 20
node -v
npm ci
```

If `nvm` is unavailable, install Node 20 LTS or configure the local version manager in use, then rerun the release gate.

## E2E Smoke Status

Not validly verified in the current local environment because only Node `v18.3.0` is available. Do not treat a Playwright run under Node 18 as a release signal for this repo.

## Quality/Coverage Status

`coverage:check` is scoped to the same release-oriented suites as `npm test`: unit, integration, server, persistence, and read-model tests. Long simulation suites remain under `npm run test:simulation` and `npm run test:full`; including them in coverage made the previous `quality` run appear to hang.

## Generated Assets

Source client changes and generated client asset updates must stay in the same commit.

- Source: `apps/client/src/**`
- Build: `npm run build:client:page`
- Generated asset: `page-assets/js/client-assets/gameplay-slice-client.js`

Do not edit generated client assets by hand.

## Live Update / Real-Time Status

Current production wording must be server sync / refresh-after-action. The current gateway does not provide real-time fanout to every client.
