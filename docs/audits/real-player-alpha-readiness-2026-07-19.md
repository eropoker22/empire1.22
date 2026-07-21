# Real-player alpha readiness — 2026-07-19

## Verdict

**NO-GO for real-player testing on the current public deployment; hosted runtime code is locally hardened.**

The repository now closes the previously identified cold restore, tick/command serialization, snapshot CAS, provisioning/lifecycle fencing, migration-contract, and gameplay polling gaps. The deployed site must nevertheless stay closed to external testers because the real-player registration/session boundary is intentionally deferred and the actual Netlify environment, target PostgreSQL schema, deployed routes, secrets, and live hosted worker have not been verified.

War mode remains closed. The first external test should use a small controlled Free server with normal public account registration enabled only for the planned test window.

## Public deployment evidence

Checked against `https://empirestreets.cz` on 2026-07-19. This is historical deployment evidence and was not refreshed after the local hardening changes:

- the static login page is publicly available over HTTPS;
- `/api/servers` responds, but the response shape showed the non-production fallback catalog rather than the durable hosted catalog;
- `/api/account/session` returned the static 404 page;
- `/api/lobby/overview` returned the static 404 page;
- the deployed gameplay boundary accepted request-provided identity far enough to produce different matchmaking authorization results.

Do not publish exploit payloads in this document. The important conclusion is that the deployed Function did not reliably enter the production fail-closed branch.

## Locally completed hardening

The current worktree contains these focused launch-preparation changes:

1. Public Netlify Function runtime is normalized to production from Netlify runtime metadata instead of relying on `NODE_ENV` being deployed.
2. `/api/account/*` and `/api/lobby/*` are routed to the gameplay Function in both `netlify.toml` and generated `_redirects`.
3. Gameplay session validation now happens before snapshot validation, runtime restore, implicit creation, or command-session bootstrap.
4. Missing sessions retain the stable `SESSION_REQUIRED` contract; invalid or cross-instance tokens fail closed.
5. Production can no longer reuse the snapshot secret as an implicit gameplay-session secret.
6. Account logout revokes all durable gameplay sessions belonging to the account.
7. Suspended accounts cannot authenticate through an old account session.
8. Malformed account cookies fail as unauthenticated instead of throwing.
9. Unexpected player-entry failures no longer return internal database exception messages.
10. Static pages and JSON Function responses receive baseline security headers.
11. Hosted worker startup now requires PostgreSQL drivers, distinct secrets, and a production-ready gameplay session repository.
12. Hosted and closed-alpha preflights require the real origin allowlist and current worker variable names.
13. A cold gameplay Function loads a ready hosted record and latest durable snapshot before join, load, submit, or command-result access; browser snapshot tokens are not runtime authority.
14. Hosted ticks use the same per-instance atomic transaction boundary as HTTP commands and publish state/events only after snapshot commit.
15. In-memory, file, and PostgreSQL snapshot repositories reject stale root versions and divergent equal-version payloads while allowing exact idempotent rewrites.
16. Provisioning begin/completion/failure is fenced by worker ID, per-process incarnation, job version, claim expiry, and runtime lease.
17. Lifecycle completion/failure locks the current processing action claim; completion additionally requires the same worker incarnation's non-expired runtime lease.
18. Production readiness uses an exact ordered migration filename/checksum contract and fails closed for missing, changed, extra, or unavailable history.
19. `game.html` enables visibility-aware gameplay polling every five seconds, pauses while hidden, refreshes on visibility return, and backs off after repeated errors.
20. Hosted commands lock and verify `ready + running` in the same PostgreSQL transaction before touching the core state, so pause/stop cannot race a late command commit.
21. Resolved runtimes atomically close the durable server, stop future ticks, close joins, and revoke gameplay sessions.

These changes are local only until explicitly committed and deployed.

## Closed code-level P0 gaps

### 1. Durable cold start for join and load

`createHostedRuntimeLoader` now resolves only a known ready hosted server, validates immutable metadata, requires the latest durable snapshot, creates the requested runtime shell, and restores it before the gameplay handler continues. Unknown, unready, missing-snapshot, mismatched, or unavailable authority fails closed. `hosted-runtime-cold-function.test.ts` covers join, load, submit, and command-result lookup through fresh Function registries without client snapshot authority.

### 2. One durable authority for tick and command

`tickInstanceDurably` reloads the latest state and saves the next snapshot inside the same per-instance atomic transaction used by commands. Runtime state and events publish only after commit; persistence failure leaves the previous state intact and crashes the runtime closed. Root versions always advance, and the shared snapshot write guard rejects stale or divergent competing writes. `atomic-tick-persistence.test.ts` covers concurrent tick/command preservation and rollback-safe publishing.

### 3. Multiplayer state refresh

`game.html` now enables five-second gameplay-slice polling. The poller pauses while the document is hidden, refreshes immediately when visibility returns, survives request errors, and applies bounded backoff. Unit coverage verifies the timer, visibility, disable/destroy, response, and failure paths.

SSE or WebSocket delivery can follow after the alpha; it is not required for the first small test. Two-client behavior still requires deployed acceptance testing.

### 4. Control-plane fencing and migration authority

Provisioning accepts only the current claimed worker incarnation/job version before changing hosted state, and lifecycle actions lock their current processing claim before completion or failure. Expired, reclaimed, or superseded worker processes cannot overwrite a newer owner; lifecycle completion also requires a live runtime lease. The production migration gate compares the complete exact checked-in migration history rather than checking only one historical migration.

## Remaining launch blockers

### 1. Real-player registration and session entry is intentionally deferred

Do not open registration as part of the admin-server provisioning phase. Keep `EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED=false`, keep joins closed by default, and do not treat local/demo identities as production players. The next phase must explicitly finish and live-verify the invite/registration policy, durable account identity, account-session to one-use join-ticket transition, gameplay-session issuance and revocation, reconnect, logout, and forged-identity rejection.

### 2. Target deployment and live worker are not proven

No local test proves the values currently configured in Netlify Functions, the target PostgreSQL migration history, route rewrites on `empirestreets.cz`, production secret separation, or a fresh hosted-worker heartbeat. Before enabling admin writes, run strict preflight against the real database, verify the deployed JSON route contracts, create one joins-closed server through admin, observe `REQUESTED -> PROVISIONING -> LOBBY`, force cold API/worker recovery, and deliberately verify tick/command and two-client polling behavior.

### 3. Result access after server completion

The durable runtime now closes joins, stops future ticks, updates hosted lifecycle state, and revokes gameplay sessions when the server resolves. Defeated players and winners still need a read-only grace path long enough to see the result and final placement card instead of losing all read access immediately.

Required result:

- expose a read-only result view for a defined grace period;
- finish or invalidate any remaining non-gameplay jobs deterministically;
- verify the top-three result flow with real durable state.

## P1 before inviting testers

- Add durable login and registration rate limiting, plus an edge/platform limit.
- Equalize password-verification work for unknown usernames to reduce timing enumeration.
- Remove duplicate session validation/touch writes per gameplay request.
- Propagate tick crashes to worker heartbeat and return readiness `503`.
- Define outage catch-up policy for income, production, cooldowns, Očista, and server end time.
- Add bounded batching for simultaneous membership and provisioning jobs.
- Add structured redacted logs, alert thresholds, metrics, and a tested backup/PITR restore runbook.
- Add snapshot retention/compaction instead of unbounded full snapshots.
- Audit CSP separately before enabling it; the current pages still contain inline-compatible surfaces.

## Safe implementation order

1. Deploy the fail-closed Function and worker builds while keeping registration and joins closed.
2. Configure both PostgreSQL drivers, distinct secrets, allowed origins, admin feature flags, and worker identity in the actual hosting secret store.
3. Apply every migration and run the exact migration gate plus strict hosted preflight against the target database.
4. Create one real joins-closed Free server through admin and verify provisioning/lifecycle fencing, worker heartbeat, and durable monitoring.
5. Force fully cold API and worker recovery, then run the real PostgreSQL tick-versus-command race probe.
6. Verify five-second polling with two independent deployed browser clients.
7. Finish and live-verify the intentionally deferred real-player registration/account/gameplay-session boundary.
8. Implement result-view grace after the now-durable resolved-server shutdown.
9. Add rate limiting, health propagation, monitoring, backups, and incident rollback notes.
10. Open one controlled Free server after the required ready-player minimum is met; keep War mode closed and enable public account registration only for the planned test window.

## Configuration gate

The hosting runtime must provide, with Function scope where applicable:

- `EMPIRE_DATABASE_URL`;
- `EMPIRE_PERSISTENCE_DRIVER=postgres`;
- `GAMEPLAY_PERSISTENCE_DRIVER=postgres`;
- `GAMEPLAY_SLICE_SESSION_SECRET`;
- `GAMEPLAY_SLICE_SNAPSHOT_SECRET`;
- `EMPIRE_ALLOWED_ORIGINS=https://empirestreets.cz`;
- `EMPIRE_HOSTED_WORKER_ID` and worker region/build metadata;
- hosted control-plane feature flags;
- closed-alpha registration flag and invite-code hash only when invitations are ready;
- admin fingerprint/bootstrap secrets through the platform secret manager.

Session and snapshot secrets must be different, random, and at least 32 characters. Do not store them in `netlify.toml`, tracked files, screenshots, logs, or test fixtures used as production input.

## Verification gate

Before the first invite, run against the real target environment:

```powershell
npm run check:browser-config
npm run typecheck
npm run lint
npm run smoke:ui
npm run test:server
npm run test:persistence:postgres
npm run test:persistence:postgres:smoke
npm run test:hosted-join:postgres
npm run test:player-entry:postgres
$env:EMPIRE_HOSTED_PREFLIGHT_STRICT='1'
npm run verify:hosted-control-plane
$env:EMPIRE_CLOSED_ALPHA_PREFLIGHT_STRICT='1'
node scripts/verify-closed-alpha-preflight.mjs
npm run test:e2e:smoke
```

A skipped PostgreSQL test is not a pass. The final browser gate must cover login, lobby, spawn selection, setup, game entry, two-player synchronization, reconnect, logout revocation, early leave, worker restart, and final server resolution.

## Live rollout policy

- Start with one Free server and a small invitation list.
- Keep joins closed until worker heartbeat, snapshot restore, and monitoring are confirmed.
- Open joins for a short scheduled window.
- Watch rejected-command codes, session failures, tick lag, snapshot age, DB pool saturation, job age, and Function errors.
- Never log passwords, cookies, session tokens, join tickets, snapshot tokens, invite codes, database URLs, or raw request bodies containing credentials.
- Have a tested close-joins and worker rollback procedure before the first tester enters.

## Current stop rule

The repository now contains the cold runtime loader, atomic tick/command boundary, snapshot CAS, claim fencing, exact migration gate, and conservative polling needed for hosted acceptance. Stop before real-player invitations until those paths pass on the actual deployed Function, target PostgreSQL, and live worker, and until the deliberately deferred registration/account/gameplay-session boundary is completed. Local green tests are not production proof.
