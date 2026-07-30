# Local hosted full-playability audit

Date: 2026-07-30
Branch: `hardening/local-hosted-full-playability`
Baseline: `13b9985 fix: simplify lobby online player count`
Audited implementation HEAD: `2fe456a test: keep hosted bootstrap identities valid`
Runtime: Node.js `v24.18.0`

## Verdict

**PASS for local hosted Free-mode acceptance.**

The guarded local stack now provisions disposable PostgreSQL-backed servers and
exercises the real account, lobby, gameplay-session, API, worker, snapshot and
browser paths. The covered gameplay surfaces remain server-authoritative and
fail closed when their hosted instance is stopped. No tested public/live path
falls back to demo gameplay state.

This is **not** production deployment approval. No public site, production
database, hosted provider, DNS, production secret set or external worker was
changed or validated. War mode and production-scale concurrency remain outside
this audit.

## Test environment

- The harness rejects databases that are not loopback-hosted and explicitly
  marked as test databases.
- Every harness run applies migrations, bootstraps admin and starts the hosted
  API, worker and frontend under Node.js 24.
- Every suite creates a disposable server through the admin control plane,
  registers real local accounts, creates validated gameplay sessions and stops
  the server during cleanup.
- Browser instrumentation rejects demo gameplay storage writes and checks that
  the active runtime remains `server-authoritative`.
- `.tmp/` contains the local Node toolchain, logs and Playwright artifacts and
  remains untracked.

The reusable entry point is:

```text
npm run test:local-hosted:full -- --suite=<suite-name>
```

## Hosted coverage

| Suite | Authoritative behavior proved | Latest green artifact |
|---|---|---|
| `city-events` | Start, shared modal state, typed server commands and reward flow | `.tmp/local-hosted-full/2026-07-29T23-34-12Z` |
| `ui-parity` | Hosted district/building presentation uses the shared game UI without demo authority | `.tmp/local-hosted-full/2026-07-30T01-31-26Z` |
| `district-selection-race` | A late district response cannot replace a newer selection or building | `.tmp/local-hosted-full/2026-07-30T04-40-10Z` |
| `production-pharmacy` | Typed queue, completion, collection and persisted reload | `.tmp/local-hosted-full/2026-07-30T00-58-24Z` |
| `production-drug-lab` | Typed production flow through the real Drug Lab card | `.tmp/local-hosted-full/2026-07-30T04-40-10Z` |
| `production-factory` | Typed production flow through the real Factory card | `.tmp/local-hosted-full/2026-07-30T00-58-24Z` |
| `production-armory` | Typed production flow through the real Armory card | `.tmp/local-hosted-full/2026-07-30T00-45-49Z` |
| `income` | Worker ticks advance authoritative income and survive reload | `.tmp/local-hosted-full/2026-07-30T01-42-46Z` |
| `building-actions-day` | All 35 day actions dispatch and persist authoritative reports | `.tmp/local-hosted-full/2026-07-30T02-20-35Z` |
| `building-actions-night` | All 4 night actions dispatch and persist authoritative reports | `.tmp/local-hosted-full/2026-07-30T02-24-40Z` |
| `multiplayer-core` | Three accounts cover bounty, market, conflicts and alliance synchronization | `.tmp/local-hosted-full/2026-07-30T03-55-26Z` |
| `lifecycle-stop` | Admin UI stop makes public listing non-joinable and player load/submit fail closed | `.tmp/local-hosted-full/2026-07-30T04-16-47Z` |

### Building actions

- Public definitions, Free-mode config, browser bridge and fresh hosted
  scenarios are aligned at **39/39** canonical actions.
- The day/night split is **35 + 4**.
- Every accepted action increases authoritative state version and produces a
  persisted `building-action` report.
- Večerka population collection is now visible and bridged.
- Magistrát emergency-decree inputs submit canonical mode IDs.

The detailed source and evidence remain in
`docs/audits/hosted-building-action-matrix.md` and
`tools/seed/hosted-building-action-matrix.json`.

### Multiplayer core

The three-player suite proves:

- distinct accounts, memberships and gameplay sessions;
- bounty creation and claim from authoritative recent events;
- market listing and purchase observed across clients;
- spy, rob, instant-alpha heist, attack and occupy commands;
- persisted battle, spy, rob and heist reports;
- alliance create, invite, accept and chat state after reload;
- no local projection, demo session or demo storage fallback.

### Lifecycle stop

The player enters the real `game.html` flow before the owner stops the same
instance through `admin.html`. The suite then verifies:

- admin status reaches `stopped`;
- the public server view reports `joinPolicy: closed` and `joinable: false`;
- authenticated gameplay `load` returns `server.instance_not_ready`;
- a transport-valid authenticated `submit` returns the same fail-closed error;
- the browser remains `server-authoritative`;
- demo fallback and local projection diagnostics remain false.

## Gaps closed

- Added a safe, reusable local hosted process supervisor, database guard,
  disposable admin fixture client and suite runner.
- Removed stale background account/session requests and local presentation
  fallbacks from hosted gameplay.
- Kept the client thin by routing visible gameplay actions through typed server
  commands and authoritative read models.
- Added persisted bounty recent-event projection instead of synthesizing
  browser-only history.
- Added typed rob and heist report projections and browser formatting.
- Namespaced durable command/event audit record IDs by server instance, avoiding
  PostgreSQL collisions for deterministic command IDs on different servers.
- Removed legacy broad district-version forwarding from attack and heist
  validation while retaining conflict revision, ownership, adjacency and lock
  checks.
- Added a bounded local API diagnostic that reports error name/code and the
  first repository frame without request payloads, tokens or SQL values.
- Kept dynamically generated hosted usernames within the validated 32-character
  account limit.
- Replaced stale source/copy assertions uncovered by the final full regression
  run with checks matching current canonical behavior.

## Final gates

| Gate | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS, including browser config, production fixture boundary, architecture, command safety and file sizes |
| `npm test` | PASS: unit, integration, server, persistence and read-model stages |
| Targeted building registry/scenario/input tests | PASS |
| Targeted bounty, conflict, audit persistence and report tests | PASS |
| `npm run test:local-hosted:full -- --suite=building-actions-day` | PASS, 35/35 |
| `npm run test:local-hosted:full -- --suite=building-actions-night` | PASS, 4/4 |
| `npm run test:local-hosted:full -- --suite=multiplayer-core` | PASS twice |
| `npm run test:local-hosted:full -- --suite=lifecycle-stop` | PASS |
| `npm run test:local-hosted:full -- --suite=production-drug-lab,district-selection-race` | PASS |

The baseline Chromium smoke was also green before the hosted fixes. It was not
repeated after every small change; the riskier final browser paths were instead
validated through the fresh hosted suites above.

## Commit series

```text
b558ebc docs: capture local hosted baseline
fe8ce5f test: automate fresh hosted parity provisioning
44b2413 fix: close hosted runtime parity gaps
b984507 refactor: clear gameplay page baseline debt
8e51587 fix: remove stale auth background fallbacks
13ae902 test: cover all hosted building actions
fe12a93 fix: close hosted multiplayer parity gaps
3a81da9 test: verify hosted lifecycle shutdown
2fe456a test: keep hosted bootstrap identities valid
```

## Remaining release work

- Repeat the hosted acceptance gates against the actual target PostgreSQL,
  deployed API/functions, production configuration and live worker.
- Verify provider-level networking, process supervision, secrets, rollback and
  observability before inviting external players.
- Run production-scale concurrency and lease-failover exercises; the browser
  multiplayer suite intentionally uses three players.
- Keep public registration and hosted gameplay closed until the existing
  production launch checklist is completed.
- Do not infer production readiness from local green results alone.
