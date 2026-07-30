# Manual hosted parity and gameplay sprint

Date: 2026-07-30
Initial HEAD: `bf53c62041132b8d69562d9d44f53665023a030e`
Final HEAD: the release commit containing this report (recorded in `git log` and the release handoff).

## Verdict

- LOCAL HOSTED SINGLE-PLAYER READINESS: **GO for the verified admin-created flow**
- LOCAL HOSTED MULTIPLAYER READINESS: **NO-GO**
- REMOTE PUBLIC TEST READINESS: **DEFERRED**

The multiplayer verdict remains NO-GO because the complete market, alliance, bounty,
concurrency, privacy, and ten-viewport matrix requested by the release gate were not
all replayed in one clean final run. No public deployment was performed.

## Historical baseline

`docs/audits/local-hosted-full-playability.md` describes behavior before
`bf53c620`. It is historical evidence only. Commit `bf53c620` changed server
creation, starting-state seeding, worker startup, persistence, generated clients,
and production routing together. A fixture PASS from the older report therefore
did not prove the current browser path.

## Root causes fixed

1. Starting materials were reconstructed through defaults and incomplete key
   mapping. Zero was not consistently preserved as an explicit configured value.
   A canonical starting-state normalizer now carries clean cash, dirty cash,
   population, spy slots, and every material into membership activation and the
   first authoritative snapshot.
2. Hosted building data leaked technical projection fields into player-facing
   rendering. Demo and hosted adapters now map onto one allowlisted presentation
   contract instead of spreading server objects into visible sections.
3. Hosted cards used incomplete market/stat projections and legacy fallback copy.
   The server projection now supplies the same named values consumed by the demo
   renderer.
4. Special actions inherited a hosted-only wrapper/layout. The shared card
   structure and source CSS now produce the demo desktop grid without a global
   `!important`.
5. District actions could fall through local geometry/demo authority. Hosted mode
   now routes visible controls to typed server commands and surfaces authoritative
   disabled reasons.
6. Polling could request the previously selected district while a new selection
   was pending. Its higher operation sequence then overwrote the fresh selection.
   Poll focus is updated before dispatch and confirmed after the response.
7. An unchanged authoritative response could restore store connection state while
   returning a stale rendered `connecting` state. The response committer now
   recomputes when connection presentation must be restored.
8. Vite's proxy connection lifecycle exhausted sockets during long hosted browser
   runs. The local hosted proxy now uses explicit keep-alive agents.
9. Admin health treated platform heartbeat as server readiness. The verifier now
   reports instance status, lease, tick movement, state version, recovery head,
   snapshot freshness, gameplay load, and gameplay submit separately.

## Starting-state trace

The new manual flow uses distinctive values:

- clean cash `123456`
- dirty cash `23456`
- population `345`
- spy slots `2`
- all canonical material keys use deterministic, distinguishable values,
  including an explicit zero

The acceptance flow checks:

`admin form -> create request -> control-plane stored state -> account membership
activation -> gameplay session seed -> runtime snapshot -> read model -> rendered
topbar/storage`.

Configured, stored, runtime, read-model, and rendered values matched in
`.tmp/local-hosted-full/2026-07-30T16-55-05Z`.

## Tick, persistence, and economy

- Per-instance verifier checks a progressing `currentTick`, `root.tick`, lease,
  state version, recovery head, snapshot age, gameplay load, and submit.
- Admin-created server tick and income passed in
  `.tmp/local-hosted-full/2026-07-30T15-55-38Z`.
- Fixed-building clean/dirty income and population sources use canonical
  day/night modifiers and server projections.
- A district without a population-producing building is not presented as if it
  generated population.
- Reload and worker-backed persistence passed in the manual admin/player replay.

## Demo and hosted UI contract

- Building cards use shared `BuildingPresentationViewModel` adapters.
- Hosted-only `Mechaniky`, raw `Efekty`, revisions, IDs, and debug payloads no
  longer become player-facing card sections.
- Visible section order/count, labels, stat values, special actions, artwork,
  desktop grid, and mobile presentation are compared by normalized DOM, computed
  styles, bounding boxes, and screenshots.
- Desktop and mobile golden parity passed in
  `.tmp/local-hosted-full/2026-07-30T15-46-10Z`.
- The supplied `img/dizajn/1-8.png` files were used as local references and were
  not committed.
- The login foreground character remains desktop-only; the phone layout hides it.

## Gameplay actions

### Real visible browser flow

The new `tests/e2e/manual-hosted-district-actions-ui.spec.js` starts from real map
canvas clicks and uses visible controls and confirmations. It captures the actual
`/api/gameplay-slice/submit` request and verifies typed payload, source/target,
revision fields, accepted report, reload, and persistence for:

- Spy
- Rob
- Heist
- Attack, including visible source district and weapon selection
- Occupy

The 2026-07-30T20-11-28Z run executed all five accepted commands and reached the
post-reload persistence checks. Its only failure was an invalid test assumption
that an occupied district must remain an `occupyTarget`; that assertion was
removed. The next cold-start run failed before gameplay because the third client
did not reach `data-runtime-init=ready`. Therefore this suite is accurately
recorded as **functionally exercised but final clean replay NOT PASS**.

### Command-level only

The existing multiplayer-core and building-action matrix suites submit through
lower-level helpers. They remain useful integration coverage but are not claimed
as visible UI acceptance. The 39-action day/night command matrix passed in
`.tmp/local-hosted-full/2026-07-30T17-07-01Z`.

## Production and other hosted systems

- Armory production passed:
  `.tmp/local-hosted-full/2026-07-30T18-01-24Z`.
- Pharmacy and Drug Lab passed:
  `.tmp/local-hosted-full/2026-07-30T18-06-14Z`.
- Factory, City Events, multiplayer command persistence, and lifecycle stop passed:
  `.tmp/local-hosted-full/2026-07-30T18-12-28Z`.
- Production assertions cover the physical building/district identity, start,
  completion, collection, and authoritative state.
- Bounty, Market, Alliance, full two-client concurrency, and private-data
  isolation were not all rerun through visible UI in this sprint.

## Admin health

The admin read model now exposes the server-saved starting state and distinguishes:

- platform readiness
- server running state
- runtime lease
- tick progression
- state-version progression
- recovery head
- snapshot freshness
- gameplay load
- gameplay submit

`npm run verify:local-hosted-runtime -- --instance=<id>` prints separate PASS/FAIL
lines instead of deriving instance readiness from a global worker heartbeat.
Freshness is lifecycle-aware; paused, stopped, and archived servers are not
reported as broken merely because they do not advance.

## Asset and cache integrity

The canonical local-hosted harness now builds browser config, gameplay client,
and admin bundle before browser acceptance. Generated bundles were produced by
their build commands, not edited manually. The Vite proxy fix prevents stale or
starved backend connections from masquerading as UI regressions.

## Verification record

PASS:

- Node `v24.18.0`
- `npm run typecheck`
- focused client concurrency and page-event tests: 23/23
- manual admin-to-player flow
- configured starting state and rendered balances
- per-server tick and income
- demo/hosted desktop and mobile parity
- Armory, Pharmacy, Drug Lab, and Factory hosted production
- City Events
- 39 building actions at command level, day and night
- multiplayer command persistence
- lifecycle stop
- `git diff --check`

FAILED / unresolved gate:

- final visible district-action replay: cold-start client readiness timeout after
  an earlier run had completed all five accepted actions

NOT RUN as a complete final gate:

- the entire repository test suite
- simulation matrices and soak
- coverage threshold
- all ten requested viewport sizes
- complete Bounty, Market, and Alliance visible flows
- remote/public deployment

## Removed or deliberately retained

- No PostgreSQL volume, applied migration, user data, or diagnostic reproducer was
  deleted.
- No demo fallback was enabled in hosted mode.
- No browser-side gameplay authority or admin resource cheat was added.
- No public deployment, War, or payments were enabled.
- Local `.tmp` diagnostics and supplied design screenshots remain untracked.

## Remaining P0/P1

P0:

- obtain one clean PASS of the final visible five-action replay after resolving
  the intermittent third-client hosted shell startup
- run visible Bounty, Market, and Alliance multiplayer acceptance
- verify private-data isolation and concurrent claims/purchases

P1:

- complete the ten-viewport golden matrix
- run the full simulation, coverage, and closed-alpha gates
- add visible UI coverage for every building action that requires structured input

The code materially closes the reproduced starting-state, card parity, extra UI,
desktop action layout, tick, income, production, typed command, and polling race
regressions. The stricter multiplayer GO bar is intentionally not waived.
