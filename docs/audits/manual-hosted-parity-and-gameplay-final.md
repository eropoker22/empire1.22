# Manual hosted parity and gameplay — final audit draft

Date: 2026-08-02
Status: **DRAFT — final clean gate and release commit are pending**

This document records only evidence that was actually captured. Historical fixture
passes are not treated as proof of the current browser path, and a green global
worker heartbeat is not treated as proof that a specific server is ticking.

No password, cookie, raw gameplay session, join ticket, snapshot token, database
URL, or other secret is included in this report.

## 1. Revisions and evidence boundary

- Historical audit: `docs/audits/local-hosted-full-playability.md`.
- Historical audit series ended around `fe799b2bc8fb07499f9bc9043a2f6c2c3246597d`.
- Sprint starting HEAD: `bf53c62041132b8d69562d9d44f53665023a030e`.
- Current committed branch base at draft time: `a694821a918b810562f031159a44255b7b207648`.
- Final release HEAD: **PENDING — insert after final commit**.
- Branch: `fix/manual-hosted-parity-and-gameplay`.
- Browser evidence is attached to its exact committed build SHA; no result from
  an older commit is treated as proof for the final worktree.

### Evidence classes

| Class | Meaning in this report |
| --- | --- |
| Historical pre-`bf53c620` | Context only; not proof for the current runtime |
| `bf53c620` fixture run | PostgreSQL/worker integration evidence, but not final UI acceptance |
| Post-`bf53c620` browser run | Valid only for the exact recorded build and flow |
| Current worktree targeted test | Narrow proof for the tested source behavior |
| Current worktree final E2E | Latest filtered diagnostic `ui-parity` run is `.tmp/local-hosted-full/2026-08-02T14-55-23Z` on exact build `a694821`: asset source/generated/served parity PASS, then all three selected population-building cases FAIL because the hosted worker advanced their authoritative buffers before capture while local demo remained at zero. This is a parity-fixture temporal-state mismatch, not a clean product PASS; the test must synchronize both states without masking availability or changing UI copy. |

## 2. Current strict verdict

<!-- FINAL_GATE_UPDATE_START -->

- LOCAL HOSTED SINGLE-PLAYER READINESS: **NO-GO**
- LOCAL HOSTED MULTIPLAYER READINESS: **NO-GO**
- REMOTE PUBLIC TEST READINESS: **DEFERRED**
- Final clean gate: **FAIL / INCOMPLETE**
- Final HEAD: **PENDING**

<!-- FINAL_GATE_UPDATE_END -->

The single-player verdict is still NO-GO at this draft boundary. The complete
shared-surface phase remains proven at `10/10`. The filtered `13:05` browser run
proved that the shared production opener reaches Factory, Armory, Pharmacy, and
Drug Lab and that Street Dealers and Recruitment Center match at all ten
viewports. Commit `a694821` then repaired the bounded School authority, Factory
presentation, Armory recipe-buffer, population-availability, countdown-layout,
and strict-capture findings with `379/379` targeted tests. The latest `14:55`
browser run reached all three selected population cards, but compared a zero-time
local demo to already-ticked hosted buffers; the parity fixture is therefore being
synchronized before those product repairs can receive browser PASS. The most
recent real admin-to-player flow passed on commit `29b3aec`, not on the final
worktree.

The multiplayer verdict remains NO-GO because the requested complete visible UI,
reload, restart, persistence, concurrency, and private-data matrices for every
social and district action have not all passed in one clean current-tree run.

## 3. What changed in `bf53c620`

Commit `bf53c620` changed several authority boundaries simultaneously:

- admin create-server state and validation;
- starting player-state serialization and membership activation;
- PostgreSQL migrations `023` and `024`;
- gameplay session seeding and initial snapshots;
- hosted worker CLI and local hosted supervisor;
- worker restore/scheduling behavior;
- production building runtime;
- district action routing;
- generated gameplay and admin bundles;
- server archive/delete lifecycle.

That breadth invalidated the older assumption that a previous fixture PASS also
proved the current admin wizard, player onboarding, served assets, runtime tick,
and visible browser behavior.

## 4. Why the old audit reported PASS

The older audit was useful for its exact code state, but it over-represented the
manual readiness of the newer runtime for four concrete reasons:

1. Several tests provisioned or seeded an already usable authoritative scenario
   instead of creating it through `admin.html`, account registration, lobby,
   faction setup, and `game.html`.
2. Command-level suites submitted valid server commands without proving that the
   visible player control could discover, enable, and construct that command.
3. Readiness relied too heavily on platform/global worker health; it did not prove
   lease ownership, tick movement, state-version movement, and snapshot freshness
   for the selected server instance.
4. Generated/served browser assets and shared CSS were not compared as an explicit
   source-build-served chain for every run, so stale output could hide or create a
   browser regression.

The current harness now records whether provisioning was a real admin browser flow
or an API fixture. `qualifiesAsManualAdminFlow: false` is never reported here as a
manual admin PASS.

## 5. Root causes and repair status

| Root cause | Repair | Status at draft cutoff |
| --- | --- | --- |
| Starting state passed through defaults/incomplete key mapping; explicit zero could be lost | Canonical typed state carries cash, population, spy slots, and all 21 material keys through creation and seed | Post-`bf53c620` evidence PASS; final current-tree admin replay pending |
| Global heartbeat was conflated with instance readiness | Per-server lease, tick, state version, recovery head, freshness, load, and submit are separate checks | Preserved runtime trace PASS; final authenticated browser/verifier replay pending |
| `verify:local-hosted-runtime -- --instance=...` could never become READY because `Server status` reported `RUNNING` while readiness expected every row to equal `PASS`; the no-instance path could also pass from global worker health alone | Explicit instance verification now accepts the required `RUNNING` lifecycle outcome, validates recovery-head/snapshot pointer parity, and the default path enumerates every running database instance; any unhealthy running instance blocks READY | `28/28` targeted verifier tests PASS; live final verifier gate pending |
| Runtime scheduling could miss trailing/known-instance cycles | Deadline, restore, and trailing-cycle handling repaired | Preserved instance tick trace PASS |
| Admin/lobby polling parsed large snapshot JSON repeatedly | Bulk stats now use committed membership/account/reservation relational fields | Targeted tests PASS; final load E2E pending |
| Lobby server discovery used `status <> 'archived'`, so a stopped disposable server remained in `availableServers`; the `14:54` bootstrap then reached `lobby.html` but its overview stayed at `Načítám…` | The PostgreSQL discovery query now allowlists only `requested`, `provisioning`, `lobby`, `running`, and `restarting`; stopped/archived instances no longer enter the joinable lobby overview | Root cause reproduced and repaired; deterministic `01:01` bootstrap plus shared surfaces PASS |
| The public `/api/servers` read loaded the global monitoring list before filtering terminal servers; with `185` stopped disposable instances, startup timed out and returned `503` at `00:22` | Public discovery now removes `stopped`/`archived` records before monitoring work and loads a scoped `getInstanceSummary` only for each surviving public server | `00:22` is the preserved pre-fix failure; `01:01` completed bootstrap and all ten shared-surface cases |
| Long hosted runs exhausted or stalled proxy/database connections | PostgreSQL physical connection-establishment timeout retries once before SQL dispatch; the idempotent hosted server-record read retries exactly once only for PostgreSQL `57014`; proxy socket retirement is tracked separately below | `23:39` preserved the pre-fix `503`/`57014`; targeted retry coverage is present and `01:01` completed shared surfaces without recurrence |
| Registration could be clicked before the modal binder attached, so the browser followed an unbound control and the overlay stayed hidden | The registration opener is fail-closed as disabled in HTML and is enabled only after `bindLoginRegistrationModal` installs its handlers; duplicate binding remains guarded | `00:09` reproduced two overlay failures; the following deterministic `01:01` shared-surface phase is `10/10` PASS |
| An inherited `PLAYWRIGHT_WORKERS=2` allowed registration/lobby bootstraps to compete, leaving four cases at `Načítám…` under latency | The local-hosted runner clears inherited worker overrides and uses the canonical deterministic one-worker Playwright configuration | `00:41` failed at `1/4/5`; the serial `01:01` shared-surface phase is `10/10` PASS |
| Hosted client rendered a second player-visible gameplay tree | Hosted client was reduced to controller/transport responsibilities; shared page runtime remains the visible renderer | Source/reachability tests PASS; full browser gate pending |
| Hosted building projection leaked non-presentation fields | Explicit presentation allowlist maps demo and hosted data into the same view model | Targeted contract tests PASS |
| Production paths used duplicate/special render or command routes | Pharmacy, Drug Lab, Factory, and Armory use shared popup rendering and durable typed commands | Earlier hosted suites PASS; final current-tree production gate pending |
| Pharmacy projection omitted the player's authoritative stored amount/capacity and Factory input costs omitted authoritative `availableAmount` | Shared production views now project those fields, preserving explicit zero with nullish handling, so hosted no longer renders false `0 ks` or quantity-only cost rows | Targeted production groups PASS; full visible restart/full-storage matrix pending |
| The first post-opener browser replay proved that Factory reached the shared popup but still formatted authoritative multipliers, durations, and produced counts differently from the demo contract (`×1.00`/`4 min`/`0 ks` versus `+0%`/`4m 00s`/`0/10 ks`) | Server-projected caps, queue caps, effective ticks, per-hour rate, multiplier, stabilization, and collect authority now feed the existing shared demo presentation schema | Included in the current `379/379` targeted PASS; focused Factory/Armory browser replay pending |
| Armory's hosted popup used the player's global starting weapon stock as each recipe's local produced-buffer amount, while the demo card showed the per-recipe production buffer | Local-demo parity seed now derives every recipe output from the canonical Armory registry while keeping global storage distinct from per-recipe collectable output | Included in the current `379/379` targeted PASS; focused Factory/Armory browser replay pending |
| Local-demo Convenience Store and School collect controls remained visually enabled at a zero population buffer while the authoritative hosted projection correctly disabled them with the canonical reason | Demo and hosted now derive availability and reason from the same canonical population-buffer presentation contract; School collect is a server-authoritative header action and the visible special-action registry remains exactly `39` | Targeted PASS. `.tmp/local-hosted-full/2026-08-02T14-55-23Z` exposed a separate fixture-time mismatch because hosted buffers ticked before the zero-state demo capture |
| Apartment's normalized DOM, style, bounds, and presentation matched, but its independently advancing proportional countdown shifted the static `Naplnění za` raster between captures | The shared countdown row uses stable numeric layout without masking the label, widening tolerance, or changing the golden baseline | Included in the current targeted PASS; latest browser replay was blocked earlier by the unsynchronized disabled reason |
| A Pharmacy mobile capture retained one isolated channel-delta pixel after two otherwise identical strict captures | The parity helper retains zero meaningful-pixel acceptance and no masks/baseline/tolerance change; it permits one additional bounded recapture and preserves every attempt as evidence | Strict helper `22/22` PASS; focused Pharmacy/Drug Lab browser replay pending |
| Quantity/input state could be reset during render/poll races | In-flight input and production quantities are preserved until authoritative response | Targeted tests PASS |
| District selection polling could overwrite a newer visible selection | Focus/operation sequencing is updated before dispatch and confirmed after response | Targeted tests PASS; earlier district race E2E PASS |
| Relative avatar/artwork CSS URLs resolved differently in hosted mode | CSS URL values are normalized to document-absolute URLs | Targeted tests PASS; completed shared building batches reached PASS at `20:51`, while the full registry gate remains pending |
| Screenshot helper truncated `url(...)` values containing `)` | Quote-aware CSS URL extraction added | Targeted regression PASS |
| Hidden hosted siblings changed normalized DOM paths | Hidden siblings are excluded and recovery UI is placed outside the shared game layout | Targeted regression PASS |
| Fractional element bounds left a one-row raster mismatch | Masks use Playwright-style enclosing raster bounds | Targeted raster regression PASS |
| City Events close button sat under the sticky tablet topbar | Canonical desktop/tablet modal inset now uses the topbar offset with matching selector specificity | Targeted CSS test plus both City Events viewport batches PASS at `20:51` |
| Social parity helper referenced `AUTHORITATIVE_TEXT` only through a Node closure | The placeholder is passed explicitly into the browser-side `locator.evaluate` payload | Test-helper repair implemented; browser rerun pending |
| Hosted normal market exposed four server resources while demo displayed two rotating offers, and hosted omitted the shared recent-clear control | Server now owns a canonical two-offer city rotation, projects `offerIndex`, validates buys against the active rotation, and feeds the shared market renderer/clear interaction | Implementation and targeted tests present; social browser rerun pending |
| Normal-market sells did not enforce the active authoritative rotation or remaining stock capacity, and the player read model exposed raw transaction authority fields | Buy/sell handlers now receive the canonical city schedule context; sells fail closed without it, reject off-rotation and black-only resources, reject over-capacity amounts atomically, and project an allowlisted `MarketTransactionView` with `isOwn` instead of transaction/player/audit IDs | Market unit suite `29/29` PASS; real two-session browser, concurrency, and privacy isolation remain pending |
| Hosted normal Market used generic metadata and a black-market heat badge, Alliance exposed raw fractional influence, and Bounty used divergent escrow/avatar/target presentation | Shared canonical metadata/copy/formatting and bounded menu layout were applied; Bounty public projection carries avatar IDs and excludes the current player from eligible targets | Market and Alliance passed the first tested viewport in three later runs; Bounty passed it in the `14:06` run; complete 21-case social matrix pending |
| Tall mobile Boost content was vertically centered by a late animation, physically placing its header/close control above the viewport | The shared mobile Boost shell is top-anchored to the safe inset with viewport-bounded height and internal body scrolling; its animation no longer applies vertical `-50%` translation | Root cause preserved in `14:06` trace; targeted guard tests PASS; clean browser rerun pending |
| Casino presentation read only legacy Heat aliases and ignored canonical `player.police.heat` / top-level `police.heat` | Building adapter now prioritizes canonical Police Heat, preserves explicit zero, then falls back to legacy fields | Targeted adapter regressions plus Casino visible parity at all ten viewports PASS in `19:39`; full non-spawn matrix pending |
| At `721-900 px`, the earlier `grid-template-columns: 1fr` rule did not reset the left/main/right items' explicit column placement; CSS Grid therefore created implicit columns whose min-content widths were driven by hosted chat copy | The tablet shell now declares all three tracks explicitly with the demo-derived ratios and `minmax(0, ...)`, while every rail/main child receives `min-width: 0`; hosted text can no longer resize an implicit track | Source/contract checks and the `20:51` whole-game tablet DOM/style/bounds matrix PASS, including `768x1024` and `820x1180` |
| Shared modal screenshots compared translucent/backdrop-filtered cards over different live page pixels, so City Events, district, and Arcade could fail PNG parity after DOM, computed-style, bounds, focus, and scroll equality had already passed | The test-only capture helper can isolate the canonical modal shell, hide unrelated siblings for a stable backdrop, capture the shared target, and restore the page; shared district/building and City Events captures use that shell | In `23:39`, both City Events, both whole-game, and both district batches PASS; Restaurant/Pharmacy reached its parity assertions but the case failed the strict clean-console gate after a separate authoritative load `503` |
| The guarded non-spawn scenario assigned building ownership but left its claimed districts at fixture heat/influence values, so authoritative action availability and modifier copy diverged from the owned local-demo comparison | The fixture now normalizes each claimed parity district to Heat `0` and Influence `10000`, clears cooldowns, and retains server authority; this is test-scenario preparation, not a browser gameplay fallback | Source repaired; Casino passed all ten viewports, while the other nine non-spawn types still need the complete browser matrix |
| Hosted owned-building count was inferred by parsing visible localized stat labels, so buildings without a `Vlastněné...` row, including Port, rendered `Počet: 0` despite authoritative ownership | The server projection computes active same-type ownership explicitly and publishes `presentation.ownedCount`; the shared adapter consumes that typed field instead of parsing copy | Included in the `127/127` targeted PASS; Casino visible parity PASS, Port and the remaining non-spawn types pending |
| Authoritative `requiresInput` metadata was copied into the visible card schema, creating hosted-only fields and card height/layout changes | Visible `requiresInput` now comes only from the demo presentation contract; server-required inputs remain under `serverAction.requiredInputs` and are used only by the shared confirmation/execution flow | Included in the `127/127` targeted PASS and targeted Casino visible PASS; full non-spawn matrix pending |
| Casino card stats and Casino action execution did not share one level-aware laundering calculation | `resolveCasinoLaunderingStats` is now canonical for both projection and execution; level `3` projects capacity `$20880` and fee `7 %` from the same configuration used to execute laundering | Included in the `127/127` targeted PASS; Casino visible parity PASS at all ten canonical viewports in the `19:39` run |
| Local-demo passive tables omitted canonical Central Bank Heat/Influence and Port Heat/Influence, while hosted projected those authoritative passives | Local runtime and generated client copies now include Central Bank `0.1` Heat/min and `0.35` Influence/min, plus Port `5` Heat/day and `26` Influence/day | Runtime/client parity regression included in the `127/127` targeted PASS; Central Bank/Port browser replay pending |
| Playwright reused disposable output locations, so later phases could overwrite screenshots and traces; large trace writes under the OneDrive worktree also increased local database/checkpoint I/O contention | Every suite/phase receives a unique output directory, and `EMPIRE_LOCAL_HOSTED_BROWSER_ARTIFACT_ROOT` can place raw browser screenshots/traces outside the worktree while `summary.json` records separate browser and log roots | `00:09`, `00:22`, `00:41`, and `01:01` record the external browser artifact root under the OS temp directory; worktree logs remain under `.tmp/local-hosted-full/<run>` |
| The non-spawn scenario seed ran through `run-local-bin.mjs` and `vite-node`, whose cold-start/import graph could consume the full `120000 ms` wrapper timeout before `hosted-e2e-scenario.mjs` executed | `hosted-e2e-scenario` is now an input of the guarded local-hosted runtime bundle and the harness executes the generated `hosted-e2e-scenario.mjs` directly; safe phase checkpoints identify load, recovery-head read, scenario apply, recovery-head save, and database close without logging secrets | Reproduced twice with empty seed logs and exit `124` at `19:13` and `19:25`; the prebundled seed completed every checkpoint at `19:39`, after which the targeted Casino browser comparison passed `2/2` |
| Hosted city-chat content expanded the tablet right-rail chat card to `218 px`, while the demo contract kept it at `164 px`, changing the right-rail grid row geometry | The canonical `721-840 px` rule now fixes the shared chat card to `164 px` and makes the nested server chat fill that same box | Reproduced at `19:59`; whole-game DOM/style/bounds PASS at every viewport in `20:51` |
| A reused Vite proxy socket reset during `/api/gameplay-slice/load`, producing a proxy-generated `500` and a console error | The prior approximately `9 s` free-socket retirement sat on the boundary of the canonical `10 s` poll: the `23:12` trace measured only about `9.07 s` between the preceding response and the next request. The proxy now retires free sockets after half the canonical poll interval (`5 s`) and removes that idle timeout while a reused socket is active | Reproduced again in `22:41` and `23:12`; Node `24.14.0` proxy regression is `10/10` PASS, and the `23:39` frontend log contains no proxy `500` or `ECONNRESET`. Its later `503` is an explicit API/PostgreSQL failure, not a proxy reset |
| The district building chip could be rerendered between Playwright lookup, hit testing, and click dispatch | Re-resolution progressed from a stale numeric index to an atomic browser-side visible/pointer target plus immediate `elementFromPoint` verification and coordinate dispatch | Earlier failures are preserved at `22:41`, `23:12`, and `23:39`; both Herna batches PASS at `00:09` and the complete shared-surface phase is `10/10` PASS at `01:01` |
| Street News could repopulate after clear on either comparison page, changing feed height and the whole left-rail geometry between signature and screenshot | Known hosted milestones are pre-acknowledged; for deterministic golden capture, both demo and hosted roots explicitly pause dynamic rumor publication before clearing, then assert zero feed items, visible empty state, and disabled clear control | `22:41` still failed to settle; `23:12` exposed `145.297 px` local versus `100 px` hosted Street News height at `1920x1080`; both whole-game batches PASS in `23:39` and again within the `01:01` `10/10` shared phase |
| Local-hosted setup invoked database migrations, admin bootstrap, and browser-config generation through separate `vite-node` cold starts; migrations could exhaust the wrapper timeout before module execution | The guarded runtime build now prebundles `database-migrations.mjs`, `bootstrap-admin-user.mjs`, and `generate-browser-gameplay-config.mjs` with the API, worker, and scenario CLI, and the harness executes those setup bundles directly | After the `22:22` setup timeout, later runs through `01:01` complete migration/admin/browser-config setup; the `00:22` failure was instead the public-list `503` described above |
| The `01:01` spawn matrix exposed six canonical projection drifts: missing precise Apartment/Convenience population buffers, a dropped Street Dealers sale view, the Recruitment camera/alarm bonus read through the wrong visible contract, rounded School population rate, and Car Dealer labels/percent scales that the adapter could not map canonically | The authoritative projection now carries typed population buffers and dealer-sale state, emits the canonical Recruitment/School/Car Dealer stat labels and precision, and the shared adapter consumes those explicit values | Targeted six-projection group `41/41` PASS; `01:01` remains the latest browser FAIL and a full matrix rerun is pending |
| Production availability was sampled before gameplay mode initialization, freezing a false local-demo policy; the district handoff then hid the district popup and delegated to a synthetic click without observing whether the asynchronous production popup actually opened | Both production runtimes now evaluate the mode policy lazily, register their real asynchronous opener in a direct bridge, and let the district handoff observe success/decline/rejection and restore the district popup on failure | Targeted production-panel group `59/59` PASS; Factory, Armory, Pharmacy, and Drug Lab still have only the pre-fix `01:01` browser FAIL until rerun |

## 6. Starting-state trace

The canonical path under test is:

`admin form -> wizard state -> create request -> server validation -> PostgreSQL
server row -> membership activation -> gameplay seed -> initial runtime state ->
snapshot -> gameplay read model -> rendered topbar/storage`.

### Preserved existing server

Safe artifact: `.tmp/manual-hosted-reproducer/current-server-safe.json`.

- configured clean cash: `2500`;
- configured dirty cash: `300`;
- configured population: `300`;
- configured spy slots: `2`;
- configured materials: all 21 canonical keys, including explicit zero values;
- actual authoritative materials: exact match for all configured material keys;
- actual population: `300`;
- actual cash and dirty cash were higher at capture because authoritative income
  ticks had already run; they are therefore not expected to equal the original
  starting values at that later timestamp.

The obsolete hard-coded `25000` clean-cash presentation is not accepted as a
source of truth. The current server configuration and authoritative resource state
are the source of truth.

### Distinctive disposable manual flow

The manual suite configures:

- clean cash `123456`;
- dirty cash `23456`;
- population `345`;
- spy slots `2`;
- deterministic, distinguishable values for all canonical materials, including
  explicit zero.

`tests/e2e/manual-hosted-admin-player-flow.spec.js` passed in
`.tmp/local-hosted-full/2026-07-31T19-57-10Z` on build `29b3aec`. It used the
admin create wizard, browser account/lobby/faction flow, visible game page, and
archived its disposable server. The same flow on the final worktree is **PENDING**.

## 7. Configured vs database vs runtime vs UI

| Layer | Evidence | Result |
| --- | --- | --- |
| Admin form/request | Distinctive manual suite on `29b3aec` | PASS for that build |
| PostgreSQL `starting_player_state` | Preserved safe reproducer and manual flow assertions | PASS for captured builds |
| Membership activation/seed | Material keys and zero preservation in authoritative state | PASS for captured builds |
| Runtime snapshot | All material balances present; population and cash states persisted | PASS for captured builds |
| Gameplay read model | Manual browser flow assertion | PASS on `29b3aec` |
| Rendered topbar/storage | Manual browser flow assertion | PASS on `29b3aec` |
| Final current worktree | Complete manual replay | **PENDING** |

No starting state is reapplied to an existing player merely because configuration
code changed.

## 8. Per-server tick trace

Safe artifact: `.tmp/manual-hosted-reproducer/current-server-tick-trace.json`.

Canonical tick rate at capture: `10000 ms`.

| Sample | currentTick | root.tick | stateVersion | clean cash | dirty cash | population | district heat | district influence |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| t0 | 252 | 252 | 259 | 4238.8 | 3309.2832 | 300 | 0.234259 | 2.625000 |
| t1 | 253 | 253 | 260 | 4245.7 | 3321.2248 | 300 | 0.255556 | 2.635417 |
| t2 | 254 | 254 | 261 | 4252.6 | 3333.1664 | 300 | 0.276852 | 2.645833 |

Captured assertions:

- `tick(t1) > tick(t0)`: PASS;
- `tick(t2) > tick(t1)`: PASS;
- state version advanced: PASS;
- cash advanced: PASS;
- snapshot advanced: PASS;
- last tick error: null for all samples.

The safe per-instance verifier later observed tick `405 -> 406`, root tick
`405 -> 406`, and state version `412 -> 413`, with snapshot age `1791 ms`.
Authenticated gameplay load/submit was explicitly **NOT AVAILABLE** because the
safe verifier did not retain a raw gameplay token.

## 9. Income: expected vs actual

Safe artifact: `.tmp/manual-hosted-reproducer/current-server-income-parity.json`.

| Metric | Expected per tick | Actual per tick | Expected per hour | Match |
| --- | ---: | ---: | ---: | --- |
| clean cash | 6.9 | 6.9 | 2484.0 | PASS |
| dirty cash | 11.9416 | 11.9416 | 4298.976 | PASS |
| population | 0 | 0 | 0 | PASS |
| district heat | 0.021296 | 0.021296 | 7.666667 | PASS |
| district influence | 0.010417 | 0.010417 | 3.75 | PASS |

The preserved server had no raw browser token, so the UI-displayed hourly values
were **NOT CAPTURED** in this artifact. They must not be promoted to PASS from the
database-only comparison.

## 10. Population

The captured owned district contained no canonical population-producing building,
so expected and actual population delta were both exactly zero. This is correct;
ownership alone must not create population.

The source model distinguishes population behavior for buildings such as Apartment
Block, Convenience Store, School, and other configured recruitment/population
sources. A complete current-tree browser matrix covering each source, caps,
collection, and negative/no-source cases is **NOT RUN** and remains a release gap.

## 11. Demo/hosted differences before repair

Observed or reproduced differences included:

- hosted-only visible technical presentation and duplicate UI roots;
- different building section structure/order in hosted fallback paths;
- special action cards stacking on desktop instead of the demo grid;
- production buildings opening through a distinct hosted path or not opening;
- relative artwork/avatar URLs resolving under different base paths;
- hidden recovery/controller nodes changing normalized game-layout paths;
- City Events close control intersecting the sticky tablet topbar;
- a stale-state chip appearing after a transient hosted load failure;
- screenshot comparison errors around quoted CSS URLs and fractional rounded edges;
- the `721-900 px` shell creating implicit grid columns whose size changed with
  hosted chat min-content;
- translucent modal screenshots composited over different live backdrops even
  after the DOM/style/bounds contracts matched;
- non-spawn fixture districts carrying the wrong Heat/Influence preparation and
  cards deriving owned count from localized visible text;
- server-required typed inputs leaking into player-visible cards;
- local Central Bank and Port passive tables missing authoritative Heat/Influence;
- Casino projection and execution using separate laundering-stat calculations.

## 12. Shared presentation after repair

The current source architecture is:

`demo data adapter -> shared BuildingPresentationViewModel -> shared building
detail renderer <- hosted authoritative adapter`.

- `page-assets/js/app/runtime/buildingPresentationAdapters.js` maps both modes.
- `page-assets/js/app/runtime/buildingPresentationContract.js` allowlists visible
  presentation fields.
- `page-assets/js/app/ui/buildingDetailPanel.js` is the shared player-visible
  renderer.
- Hosted transport may supply different authoritative values, IDs, availability,
  cooldowns, and disabled reasons, but it does not own a separate visual design.
- `presentation.ownedCount` and `presentation.passive` are explicit typed
  presentation inputs; the renderer no longer reverse-engineers ownership from
  localized stat copy.
- `presentation.populationBuffer` carries precise authoritative stored amount,
  capacity, and per-minute production for Apartment Block and Convenience Store;
  School keeps the same canonical rate precision as the demo.
- Street Dealers retain the authoritative `dealerSale` slots, inventory, unit
  price, and minimum quantity through the allowlisted adapter rather than losing
  the shared sale controls.
- Recruitment Center and Car Dealer publish the canonical support labels and
  percentage scale consumed by the demo presentation contract.
- Authoritative action inputs are retained privately in
  `serverAction.requiredInputs`; the visible card exposes only inputs present in
  the canonical demo presentation, while the shared confirmation fills canonical
  defaults before typed command submission.
- The generated gameplay client acts as a controller/transport mount rather than
  a second full player-facing page renderer.

There is no claim that every debug helper in the repository was deleted. The
verified claim is narrower: no reachable duplicate player-visible building
renderer should remain on the canonical game entry path.

## 13. Canonical building coverage

The parity suite derives its matrix programmatically from
`publicBuildingDefinitions`; it does not rely on the prompt's handwritten list.
The current registry has 32 canonical types:

- Downtown: Central Bank, City Hall, Lobby Club, Stock Exchange, Court, VIP
  Lounge, Airport, Port, Parliament;
- Commercial: Shopping Mall, Restaurant, Casino, Car Dealer, Fitness Club,
  Exchange, Pharmacy;
- Residential: Apartment Block, Recruitment Center, Garage, Clinic, School,
  Arcade;
- Industrial: Factory, Armory, Warehouse, Power Station, Recycling Center;
- Park: Drug Lab, Smuggling Tunnel, Convenience Store, Strip Club, Street Dealers.

The browser matrix is split into 22 spawn-reachable types and 10 non-spawn types.
The latter use an explicit authoritative scenario fixture and are therefore not
misrepresented as a manual admin-created world.

The `16:32` non-spawn run correctly remained FAIL: it exposed the fixture
Heat/Influence mismatch, `Počet: 0` from localized-label parsing, hosted-only input
controls, level-unaware Casino laundering stats, and missing local Central
Bank/Port passives. Those sources are repaired and have targeted coverage.

Two replacement attempts, `2026-08-01T19-13-42Z` and
`2026-08-01T19-25-27Z`, then reproduced a separate harness failure. Bootstrap
passed, but each scenario process exited `124` after `120000 ms`, and both
`seed-ui-parity-non-spawn.log` files were zero bytes. The scenario module had not
reached its first statement: `vite-node` cold-start and import preparation had
consumed the wrapper budget before module execution. This was not evidence of a
database or gameplay-seed failure.

The repaired harness prebundles `hosted-e2e-scenario.mjs` beside the API and
worker entrypoints and executes that Node bundle directly. Its safe checkpoints
are `load-server`, `load-recovery-head`, `apply-scenario`,
`save-recovery-head`, and `database-close`, each with `start`/`done` markers.
The `19:39` run reached every marker and persisted the scenario at tick `5`,
state version `4`. The subsequent targeted Casino matrix declaration and Casino
comparison passed `2/2` at all ten canonical viewports (`6.9 m` Casino,
`7.3 m` Playwright total). The outer wrapper timed out only after that Playwright
PASS had already been written to the preserved log. This is valid targeted Casino
evidence, not a full ten-type `ui-parity-non-spawn` PASS.

## 14. Server-only sections and duplicate UI

Raw mechanics payloads, effect internals, revisions, server IDs, and debug labels
are not spread directly into the player card. Only allowlisted presentation fields
reach the shared renderer.

The same boundary now applies to typed action inputs. A server projection may
require fields such as market category or investment amount, but those definitions
stay under `serverAction.requiredInputs`; they do not create hosted-only form rows
inside the building card. The shared confirmation uses canonical defaults (for
example `targetCategory: "materials"` and `investmentCleanCash: 1000` for
`speculative_buy`) and still submits the authoritative typed payload.

The words `Mechaniky` or `Efekty` may still exist where they are part of the demo's
own canonical shared card. The repaired contract removes **hosted-only** sections;
it does not delete a section that is visibly present in the demo.

Player-visible legacy hosted controllers and their dedicated styling were removed
or disconnected together with their obsolete tests. Source reachability and
duplicate-visible-UI guards exist, but the final current-tree browser replay is
still pending.

## 15. Special action layout

The parity contract checks the actual parent wrapper, computed display,
`grid-template-columns`, column/row counts, bounds, and responsive behavior.

- desktop/tablet expected contract: two columns where the demo uses two columns;
- phone expected contract: one column where the demo stacks actions;
- no global `!important` was introduced as a parity shortcut.

Whole-game tablet chrome had a separate layout defect. Between `721` and `900 px`,
the shell declared one explicit column while the three child regions still
targeted columns `1`, `2`, and `3`. Columns `2` and `3` became implicit auto tracks,
and hosted chat min-content widened them differently from the demo. The repair
declares the demo-derived three tablet tracks explicitly with `minmax(0, ...)` and
sets each child to `min-width: 0`; it does not special-case hosted copy or add a
global override.

The latest failed Arcade grid observation happened after a six-minute timeout and
a transient hosted load failure. It is not recorded as PASS. The deterministic
raster/helper defects were repaired afterward; a clean current-tree rerun is
**PENDING**.

## 16. Visible district actions

`tests/e2e/manual-hosted-district-actions-ui.spec.js` begins from the real map and
visible popup controls, captures the actual typed submit, checks source/target and
revision authority, observes the server response, reloads, and checks persistence.

### Spy

- visible route and typed command were exercised in an earlier run;
- server projection supplies target/corridor authority;
- a complete final current-tree replay including report, heat, cooldown, reload,
  and private-data separation is **NOT PASS YET**.

### Rob

- visible route and typed command were exercised in an earlier run;
- authoritative source/target and revision fields were captured;
- complete final loot/population/heat/cooldown/reload evidence is **NOT PASS YET**.

### Occupy

- visible route and accepted command were exercised;
- a false test assumption that an occupied district must remain an `occupyTarget`
  was removed;
- final clean current-tree replay is **PENDING**.

### Heist

- visible route and accepted command were exercised;
- final complete delta/report/reload matrix on the current tree is **PENDING**.

### Attack

- visible source district and weapon selection were exercised;
- accepted authoritative command and post-reload state were reached in an earlier
  run;
- final current-tree replay is **PENDING**.

An earlier run reached all five accepted actions and post-reload checks, but the
next cold-start run failed before gameplay when a third client did not reach
`data-runtime-init="ready"`. Therefore this area is intentionally not labeled a
clean PASS.

## 17. Production buildings

Historical post-`bf53c620` hosted fixture evidence:

| Building | Artifact run | Exact build | Result |
| --- | --- | --- | --- |
| Armory | `.tmp/local-hosted-full/2026-07-30T18-01-24Z` | `bf53c620` | PASS |
| Pharmacy | `.tmp/local-hosted-full/2026-07-30T18-06-14Z` | `bf53c620` | PASS |
| Drug Lab | `.tmp/local-hosted-full/2026-07-30T18-06-14Z` | `bf53c620` | PASS |
| Factory | `.tmp/local-hosted-full/2026-07-30T18-12-28Z` | `bf53c620` | PASS |

Those tests cover authoritative physical building/district identity, production
start, worker completion, collection, and persisted state for the recorded build.
They do not by themselves prove the final worktree or every requested edge case.

Two current projection defects were found after those historical runs:

- Pharmacy hosted presentation did not receive the player's authoritative stored
  amount and storage capacity, so it could display a false `0 ks`;
- Factory hosted cost rows did not receive authoritative `availableAmount`, so a
  row could display only the requested quantity instead of the demo-style
  `available / required` value.

Both projections and their shared view types now carry the missing values and
preserve explicit zero with `??`. Targeted production projection/integration
groups passed (`110/110`, followed by the focused zero-value group `71/71`); the
counts overlap and are not a replacement for browser acceptance.

The later `01:01` browser run exposed a separate opening defect for all four
production chips. `isLocalDemoGameplayExecutionMode()` had been evaluated while
constructing the popup runtimes, before runtime mode initialization, so the
legacy-local policy was frozen false. The handoff could then hide the district
popup and dispatch a synthetic click without awaiting the real asynchronous
opener, producing a visible ghost click.

The runtime now passes the mode predicate itself and both production popup
runtimes evaluate it at action time. Factory and the shared Pharmacy/Drug Lab/
Armory runtime register their actual asynchronous `openPopup` function through
`productionPopupOpenBridge.js`; the district handoff invokes that opener directly,
observes its result, and restores the district popup when the opener is missing,
declines, or rejects. The focused production-panel result is `59/59` PASS. This is
source/helper proof only: the latest browser artifact is still the pre-fix `01:01`
FAIL and the four-building visible rerun remains mandatory.

The existing browser lifecycle proves quantity `2`, exact reservation,
cancel/refund, worker completion, collection of `1`, reload, and persisted state.
It does **not** prove visible full-storage or true partial-collect behavior, and
its `afterRestart` label represents a second start rather than an actual worker
or server restart. The helper also opens the district through a controller call
before the visible building click, so it is not claimed as a pure map-click flow.
Still incomplete as one current-tree visible matrix: full storage, true partial
collect, cancel/refund for every building, in-flight worker restart, complete
server restart, and every state-version transition.

## 18. All 39 building actions

The canonical action matrix contains 39 unique action IDs: 35 day actions and 4
night actions.

- Command-level fixture matrix passed day and night on `bf53c620` in
  `.tmp/local-hosted-full/2026-07-30T17-07-01Z`.
- A visible-UI matrix now opens the building from the map/card, finds the visible
  control, prepares required input, confirms the action, captures the typed
  command, and checks the authoritative response.
- Server-only input definitions no longer alter the card DOM. They are consumed by
  the same confirmation path, which prepares canonical defaults before submitting
  the typed command.
- Casino laundering projection and execution share one level-aware calculation;
  the targeted integration case verifies level `3` capacity `$20880` and fee
  `7 %`.
- The visible-UI 39-action matrix has **NOT yet completed a final clean run on the
  current worktree**.

No action is promoted from command-level PASS to visible-UI PASS without the
browser evidence.

## 19. City Events

- Worker-backed City Events suite passed on `bf53c620` in
  `.tmp/local-hosted-full/2026-07-30T18-12-28Z`.
- Current whole-game parity runs exercised City Events in both demo and hosted.
- The tablet close interception was reproduced and fixed at the canonical modal
  inset/specificity source.
- Targeted CSS and direct browser-trace checks passed after the fix.
- Full current-tree City Events start/completion/reward/pending-claim/restart
  acceptance remains **PENDING**.

## 20. Bounty

The local/demo and hosted paths now share neutral `ESCROW` copy. Local demo cash
comes from the fixture/session bridge with explicit zero preserved; hosted target
avatars come from the shared live avatar catalog. The authoritative public
projection carries `avatarId` and removes the current player from
`eligibleTargets` instead of exposing a disabled self target. Long authoritative
target names are constrained to the shared menu width.

Browser progression:

- `13:45` reached Market PASS and Alliance PASS, then exposed a Bounty target
  presentation/width mismatch;
- `13:56` again passed Market and Alliance, then isolated the remaining Bounty
  menu-width mismatch;
- `14:06` passed Market, Alliance, and Bounty for the first tested viewport before
  the suite stopped on Boost.

This is valid visible parity evidence for that tested viewport, not a complete
responsive or gameplay PASS. The requested full two-player create, escrow,
objective completion, payout, history, cancel, expiry, concurrent claim, reload,
and worker-restart matrix has not passed as a single final current-tree gate.
Status: **NO-GO / NOT RUN fully**.

## 21. Market

The hosted UI now reads the authoritative market player view model rather than a
demo seller fallback.

The `2026-08-01T10-37-35Z` social parity run exposed a real product difference at
`320x568`: the demo rendered two rotating normal-market offers and the shared
“clear recent transactions” control, while hosted rendered four offers and no
clear control. The larger hosted DOM also changed scroll height and prevented
exact structural parity.

Root cause: the authoritative normal-market projection treated every normal
resource as simultaneously available and did not expose the demo-compatible
rotation order. The hosted popup also did not use the shared recent-transaction
clear presentation.

Implemented rotation/shared-clear repair, with browser result recorded below:

- authoritative normal market now selects exactly two offers from a deterministic
  city-time window;
- the server projection exposes `offerIndex` and the client sorts by it;
- normal-market buys validate that the requested resource is in the current
  authoritative rotation;
- hosted rendering uses authoritative balances, stock, offers, and refresh data
  without a local market fallback or local refresh timer;
- the shared clear control is present in hosted mode; it hides the current recent
  list in the browser presentation without deleting authoritative server history.

Targeted game-core/runtime tests cover the new rotation and renderer contract.
The later shared metadata/badge repair removed the remaining normal-market visual
difference. Market then passed the first tested viewport in the `13:45`, `13:56`,
and `14:06` social runs. The full two-client listing, escrow, buy, concurrency,
cancel, expiry, seller delta, reload, and worker-restart matrix is still **NOT RUN
fully**.

### Browser reproduction and repair progression

Run `.tmp/local-hosted-full/2026-08-01T11-05-22Z` passed harness bootstrap and all
source/generated/served asset parity checks, then failed Market social parity on
the first of 21 cases at `320x568`; the remaining 20 cases did not run.

The authoritative rotation repair is visible in this run: demo and hosted now
render the same two offer IDs in the same rotation. Exact presentation is still
not equal because hosted:

- renders generic category metadata instead of the canonical demo item metadata;
- adds a black-market heat-derived badge to a normal-market offer;
- is consequently `12 px` taller and has a `12 px` greater scroll range.

This remains the valid pre-fix reproduction. After the shared metadata/badge
repair, Market passed the first tested viewport in three later real browser runs:

- `.tmp/local-hosted-full/2026-08-01T13-45-14Z`;
- `.tmp/local-hosted-full/2026-08-01T13-56-24Z`;
- `.tmp/local-hosted-full/2026-08-01T14-06-04Z`.

None of those runs completed all 21 social cases, so only the tested viewport is
recorded PASS and the complete responsive Market verdict remains pending.

### Market authority hardening

The three P0 source-review findings are implemented and covered by the targeted
Market unit suite:

- normal-market sell receives the same authoritative city-rotation context as
  buy and fails closed when that context is unavailable;
- off-rotation normal resources and black-market-only resources are rejected
  before player balances, stock, volume, or transaction history can mutate;
- remaining stock capacity is calculated before debit/payout; an over-capacity
  sell is rejected atomically with `NORMAL_MARKET_STOCK_CAPACITY_EXCEEDED`, while
  an exact-capacity sale succeeds without clamping away paid inventory;
- the player projection maps each raw transaction to an explicit
  `MarketTransactionView`. It retains public trade facts and `isOwn`, but excludes
  `id`, `playerId`, and `auditTriggered` from every player's read model.

`tests/unit/game-core/server-market-system.test.ts` passes `29/29`, including the
direct rule paths, command-handler context propagation, no-partial-payout capacity
case, off-rotation/black-only rejection, and cross-player projection redaction.
This is not a substitute for two authenticated browser sessions. Visible listing,
escrow, buy/sell, concurrency, seller delta, reload/restart, and network-observed
private-data isolation remain **PENDING**.

The two P1 presentation findings also remain pending final browser verification:

- an already-open hosted Market popup must rerender from each fresh authoritative
  projection;
- the normal-market refresh chip must use the canonical normal rotation schedule,
  not a black-market or fallback timestamp.

## 22. Alliance

The hosted runtime uses authoritative alliance state and shared presentation. Raw
fractional authoritative influence is now formatted with the same integer
player-facing contract as demo; eligibility math remains server-authoritative and
unchanged. The local fixture registry was also made module-query-stable so the
demo and hosted tests actually open the same five-tab Alliance modal rather than a
fallback fixture branch.

Alliance passed the first tested viewport in the `13:45`, `13:56`, and `14:06`
real browser runs. Those runs did not complete the full social viewport matrix,
and create, invite, accept, max members, reload, chat (if canonical), modifier
application, concurrency, and private-data isolation have not all passed in a
final current-tree browser gate. Status: **NO-GO**.

### Boost mobile modal

The `14:06` run passed Market, Alliance, and Bounty, then timed out closing Boost
at `360x800`. The trace showed a visible close button physically outside the
viewport: a late shared mobile animation vertically centered a modal taller than
the viewport. The repair top-anchors Boost at the safe inset, constrains its shell
to the viewport, scrolls the body internally, and removes vertical `-50%` from the
Boost-only mobile animation. Targeted CSS/cleanup guards pass; a clean browser
rerun is still pending.

## 23. Heat, police, influence, population, and reports

The authoritative tick artifact proves that district heat and influence advance
with the same per-tick deltas calculated by the server. Current source changes
also route Wanted, Police Heat, profile, leaderboard, report, and topbar data
through the shared server-authoritative page presentation instead of a duplicate
hosted controller tree.

Casino had a separate presentation bug: its audit-risk display ignored canonical
`player.police.heat` / top-level `police.heat` and read only legacy aliases. The
adapter now gives canonical Police Heat priority, preserves canonical zero over a
stale legacy value, and falls back only for compatibility. Targeted cases prove
Heat `101` renders `Audit risk 18 %` and canonical `0` wins over legacy `180` to
render `8 %`. A visible current-tree Casino replay is still pending.

Targeted unit tests cover these bridges. A complete current-tree browser matrix
for every action's district heat, player Police Heat, Wanted, decay, raid,
population cap/source, Street News, reload, and admin projection is **NOT RUN**.

## 24. Snapshot and lifecycle health

Historical broken reproducer:

- server status was `running`;
- recovery tick/root tick were both `53` and state version `63`;
- snapshot and worker/instance heartbeat age were approximately 5.98 minutes;
- global worker status still appeared online.

This proves why global worker online was insufficient.

Current verifier behavior separates:

- server lifecycle and provisioning;
- worker heartbeat;
- instance lease owner/expiry;
- tick progression;
- state-version progression;
- recovery head;
- snapshot freshness;
- authenticated gameplay load/submit availability.

Two verifier correctness defects were repaired on the current worktree:

1. explicit `--instance` verification no longer compares the required lifecycle
   label `RUNNING` against the generic string `PASS`;
2. the default no-instance command no longer treats one global worker heartbeat
   as fleet readiness: it discovers every running instance in PostgreSQL and
   verifies each one, while any unhealthy instance blocks READY.

Recovery head and current snapshot pointers must also identify the same snapshot.
A zero-running-instance environment may report platform/global readiness, but it
is not evidence that a game server is ticking. Targeted verifier coverage is
`28/28` PASS; the final live authenticated load/submit gate remains pending.

Freshness is lifecycle-aware: running expects progression; paused/stopped/archived
do not receive a false running-stale interpretation. The current admin/read-model
implementation has targeted tests; full final dashboard browser replay is pending.

## 25. Admin dashboard and delete/archive

Admin now distinguishes platform readiness, server running, server ticking, server
persisting, and command/load availability rather than showing one green platform
indicator. It also exposes the server-saved starting state instead of echoing only
local wizard state.

The real manual flow on `29b3aec` created and later archived its disposable server.
The full owner-only negative cases, exact-name confirmation, gameplay-session
revocation, replay safety, inactive filtering, two-player lobby return, and new
server selection matrix is **NOT RUN fully** on the final worktree.

The `14:54` social bootstrap exposed a separate lobby lifecycle bug after a prior
diagnostic server was intentionally preserved as stopped. PostgreSQL discovery
used `status <> 'archived'`, which still returned stopped instances and left the
newly registered player's lobby overview at `Načítám…`. Discovery now allowlists
only join/recovery-capable statuses (`requested`, `provisioning`, `lobby`,
`running`, `restarting`). This source repair has targeted query assertions, but
the clean browser bootstrap rerun is pending and the failure is not relabeled PASS.

## 26. Removed code and CSS

The current worktree removes the old second player-visible hosted UI stack,
including dedicated building/market/report/status/settings/leaderboard/police
controllers and their obsolete tests. It also removes the obsolete generated
gameplay-slice stylesheet and server-defeat stylesheet from the canonical page
path.

At this draft boundary the deletion inventory is 50 tracked files: 34 source
files, 2 CSS files, and 14 superseded tests. The read-only reachability audit
checked every deleted filename and extensionless stem across live imports,
dynamic imports, HTML entries, and build inputs and found no remaining runtime
reference. The only remaining non-test textual mention is historical audit prose
for the removed gameplay-slice stylesheet.

The old 30-module `serverGameplay*` cluster was self-contained and terminated at
`serverGameplayUiController.js`, which had no production importer. The removed
production-popup ownership helper had exactly two prior importers; both ownership
and direct opener registration now live in the two current popup runtimes. The
removed client building-popup renderer had no importer even at the starting HEAD.
The deleted server-defeat selectors have no live HTML/JS use and the shared
lifecycle modal is their replacement. Selector analysis also found no reachable
use of the removed gameplay stylesheet beyond the hidden generated controller
root token.

`runtime-refactor-guard.test.js` checks that the removed paths stay absent and
that their source directories contain no dangling references. A focused
replacement/reachability run covering 20 test files passed `197/197` in `84.5 s`.
This establishes static replacement coverage; it does not turn the outstanding
browser parity gate into PASS.

The project still uses modular shared CSS files; “one CSS” means one canonical
shared cascade for demo and hosted, not one physically monolithic stylesheet.
No hosted-only building-card stylesheet should override that cascade.

Deletion claims are limited to files shown unreachable by imports, HTML entry
points, runtime bindings, and replacement tests. No file was deleted merely
because its name contained `legacy`.

## 27. Responsive and golden parity matrix

Canonical viewports:

`320x568`, `360x800`, `390x844`, `430x932`, `768x1024`, `820x1180`,
`1024x768`, `1366x768`, `1440x900`, `1920x1080`.

The comparison records normalized DOM, visible section/class order, computed
styles, bounding boxes, focus, scroll, and paired PNG screenshots. Dynamic leaf
values and narrowly justified raster edge regions may be masked; missing sections,
different wrappers, grids, CTA, spacing, typography, and layout are not masked.
The PNG assertion is zero meaningful pixels outside explicit channel tolerance and
documented masks; it is not a claim of byte-identical PNG metadata.

For diagnosis only, `EMPIRE_UI_PARITY_DEBUG_BUILDING_TYPES` can restrict the
spawn-building declaration when `--suite=ui-parity` is the sole selected suite.
That mode runs only the `spawn-building-matrix` group, emits
`comprehensiveParityGate: false` plus the selected `debugBuildingTypeIds`, and
prints that it is not a comprehensive parity gate. With the variable unset, the
full `spawnReachableBuildingParityMatrix` remains unchanged. A filtered run must
never be used as release PASS evidence.

### Latest current-build parity and harness runs

| Run | Result | Exact observation |
| --- | --- | --- |
| `.tmp/local-hosted-full/2026-08-01T09-19-21Z` | FAIL: 9 passed, 1 failed | Only remaining failure was City Events tablet close interception; other shared-surface cases passed |
| `.tmp/local-hosted-full/2026-08-01T09-57-29Z` | FAIL: 6 passed, 2 failed, 2 did not run | Whole-game stale chip followed one PostgreSQL connection-establishment timeout; Arcade grid check failed after the long degraded run |
| `.tmp/local-hosted-full/2026-08-01T10-29-37Z` | FAIL: 1 failed, 20 did not run | Social parity stopped in its helper because `AUTHORITATIVE_TEXT` was not serialized into the browser `locator.evaluate`; this run produced no valid product-parity verdict |
| `.tmp/local-hosted-full/2026-08-01T10-37-35Z` | FAIL: 1 failed, 20 did not run | After the helper repair, Market at `320x568` exposed a real difference: demo had two rotating offers plus recent-clear, hosted had four offers without recent-clear |
| `.tmp/local-hosted-full/2026-08-01T11-05-22Z` | Bootstrap PASS; asset parity PASS; social parity FAIL: 1 of 21 failed, 20 did not run | Demo and hosted now had the same two offer IDs; hosted still used generic category metadata plus an extra black-market heat-derived badge, producing a `12 px` height/scroll delta |
| `.tmp/local-hosted-full/2026-08-01T13-45-14Z` | FAIL: 2 passed, 1 failed, 18 did not run | Market and Alliance passed the first viewport; Bounty exposed target text/cursor/bounds differences; unique Playwright artifacts were preserved |
| `.tmp/local-hosted-full/2026-08-01T13-56-24Z` | FAIL: 2 passed, 1 failed, 18 did not run | Market and Alliance again passed; Bounty was reduced to a menu-width mismatch |
| `.tmp/local-hosted-full/2026-08-01T14-06-04Z` | FAIL: 3 passed, 1 failed, 17 did not run | Market, Alliance, and Bounty passed the first viewport; Boost close at `360x800` was outside the viewport and timed out |
| `.tmp/local-hosted-full/2026-08-01T14-54-16Z` | Bootstrap FAIL: 1 failed | Registration redirected to lobby, but overview remained `Načítám…`; root cause was a stopped server admitted by `status <> 'archived'`; screenshots and trace were preserved |
| `.tmp/local-hosted-full/2026-08-01T16-32-11Z` | `ui-parity` FAIL: 5 passed, 4 failed, 1 did not run; `ui-parity-non-spawn` FAIL: 1 passed, 7 failed | Shared whole-game tablet chrome exposed implicit grid tracks; City Events, district, and Arcade were pixel-only compositing failures after structural equality; non-spawn cards exposed fixture Influence/Heat, owned-count, server-input, Casino-stat, and local-passive drift |
| `.tmp/local-hosted-full/2026-08-01T17-37-18Z` | Preserved partial run: shared-surface phase 8 passed, 1 failed, 1 did not run | Stable-backdrop repairs passed both City Events, district, and Arcade batches plus Restaurant/Pharmacy. Whole-game chrome failed by `16` meaningful pixels at `360x800`; its later tablet and non-spawn phases did not complete in that run |
| `.tmp/local-hosted-full/2026-08-01T19-13-42Z` | Bootstrap PASS; scenario seed FAIL with exit `124` | The seed log remained zero bytes because the `vite-node` cold start exhausted the `120000 ms` wrapper timeout before the scenario module executed |
| `.tmp/local-hosted-full/2026-08-01T19-25-27Z` | Bootstrap PASS; repeated scenario seed FAIL with exit `124` | The second zero-byte seed log reproduced the same pre-module timeout and ruled out treating the first attempt as an isolated database/gameplay failure |
| `.tmp/local-hosted-full/2026-08-01T19-39-44Z` | Targeted Casino browser evidence PASS: `2/2` in `7.3 m`; Casino `6.9 m` | The prebundled seed completed all safe checkpoints, then Casino matched at all ten canonical viewports. The outer wrapper timed out only after the Playwright PASS was saved; this is not a full non-spawn matrix PASS |
| `.tmp/local-hosted-full/2026-08-01T19-59-44Z` | Shared surfaces FAIL: `6` passed, `3` failed, `1` did not run in `11.3 m` | Whole-game tablet exposed chat content geometry (`164 px` demo versus `218 px` hosted); City Events recorded one transient Vite proxy `read ECONNRESET`; Herna hit a chip-rerender click race. These three causes drove the subsequent repairs and reruns |
| `.tmp/local-hosted-full/2026-08-01T20-28-03Z` | Shared surfaces FAIL: `8` passed, `1` failed, `1` did not run in `11.1 m` | Both whole-game batches PASS, including `768x1024`/`820x1180`; both City Events batches PASS without `500`; both district batches and Restaurant/Pharmacy PASS. The only failure is a Herna helper false-negative after the dispatched click had already opened the visible panel and removed the chip |
| `.tmp/local-hosted-full/2026-08-01T20-51-23Z` | Shared surfaces FAIL: `9` passed, `1` failed, `0` did not run in `13.6 m` | Both City Events, district, Herna, and Restaurant/Pharmacy coverage PASS. Every whole-game DOM/computed-style/bounds/scroll comparison also passed; only the `1920x1080` whole-game PNG comparison failed with equal dimensions and `35236` meaningful pixels |
| `.tmp/local-hosted-full/2026-08-01T21-34-13Z` | Shared surfaces FAIL: `6` passed, `2` failed, `2` did not run in `16.1 m` | Both City Events, both district, Restaurant/Pharmacy, and the registry declaration PASS. The first whole-game batch could not stabilize the repeatedly injected Street News welcome entry; the first Herna batch hit a stale numeric chip-index race, so their serial second batches did not run |
| `.tmp/local-hosted-full/2026-08-01T22-22-02Z` | Harness setup FAIL before browser execution | Database migrations exited `124`; the zero-byte migration log reproduces another `vite-node` cold-start timeout before the migration module emitted output |
| `.tmp/local-hosted-full/2026-08-01T22-41-41Z` | Shared surfaces FAIL: `3` passed, `3` failed, `4` did not run in `11.3 m` | Prebundled setup and bootstrap PASS. Both City Events batches and the registry contract PASS; whole-game could not settle Street News, another context left registration disabled after a proxy `ECONNRESET`, and Herna timed out during locator click |
| `.tmp/local-hosted-full/2026-08-01T23-12-24Z` | Shared surfaces FAIL: `6` passed, `3` failed, `1` did not run in `11.0 m` | Both district batches and Restaurant/Pharmacy PASS. Whole-game tablet/desktop exposed local `145.297 px` versus hosted `100 px` Street News geometry, City Events recorded a proxy-generated load `500`/`ECONNRESET`, and Herna had no stable pointer target |
| `.tmp/local-hosted-full/2026-08-01T23-39-18Z` | Shared surfaces FAIL: `7` passed, `2` failed, `1` did not run in `14.2 m` | Registry, both whole-game, both City Events, and both district batches PASS; no proxy reset recurred. Restaurant/Pharmacy failed the strict clean-console gate on authoritative load `503` / PostgreSQL `57014`, while Herna dispatched through the verified pointer but no popup appeared; its second batch did not run |
| `.tmp/local-hosted-full/2026-08-02T00-09-03Z` | Shared surfaces FAIL: `5` passed, `2` failed, `3` did not run | City Events and both Herna batches PASS. Two parallel registration entries clicked before the modal binder was ready, so the registration overlay remained hidden; this is the preserved pre-fix fail-closed/binding race |
| `.tmp/local-hosted-full/2026-08-02T00-22-21Z` | Startup FAIL before browser suite | Readiness polling of `/api/servers` received `503`; the public list performed global monitoring work across `185` stopped disposable servers before filtering them. Browser artifacts were already routed to the external temp root, but no parity case ran |
| `.tmp/local-hosted-full/2026-08-02T00-41-55Z` | Shared surfaces FAIL: `1` passed, `4` failed, `5` did not run | An inherited two-worker Playwright run made four registration/lobby contexts compete under hosted latency; they reached lobby but remained at `Načítám…`. This is harness concurrency evidence, not a demo/hosted visual mismatch |
| `.tmp/local-hosted-full/2026-08-02T01-01-57Z` | Shared surfaces PASS: `10/10`; spawn matrix FAIL: `2/12` passed, `10/12` failed | Deterministic one-worker bootstrap, public-list scoping, fail-closed registration binding, external browser artifacts, and the narrow `57014` read retry allowed every shared-surface case to pass. The next phase exposed six presentation-value failures (`convenience_store`, `apartment_block`, `street_dealers`, `recruitment_center`, `school`, `car_dealer`) and four production chips with no visible pointer target (`factory`, `armory`, `pharmacy`, `drug_lab`) |
| `.tmp/local-hosted-full/2026-08-02T13-05-18Z` | Filtered spawn diagnostic: Street Dealers and Recruitment Center PASS; six cases FAIL; Drug Lab incomplete; Car Dealer not run; outer group exit `124` at `1800 s` | The opener repair is browser-proven because Factory, Armory, Pharmacy, and Drug Lab all reached their shared popup. Exact residuals are zero-buffer population availability (Convenience Store/School), Apartment countdown raster stability, Factory production formatting, Armory recipe-buffer mapping, and one isolated Pharmacy compositor pixel after two strict captures. Drug Lab had entered desktop capture when the bounded group deadline stopped the run. This debug selection is not a comprehensive gate |
| `.tmp/local-hosted-full/2026-08-02T14-55-23Z` | Filtered population diagnostic on exact build `a694821`: asset parity PASS; `3/3` selected cases FAIL; process exit `1` in `424.6 s` | Convenience Store and Apartment were disabled in both modes but their reason text differed because hosted had accumulated a positive sub-minimum buffer; School had advanced to `1/20` and enabled collect while local demo remained `0/20`. The runner correctly classifies this debug selection as non-comprehensive. No reason, enabled state, or raster region is masked; the parity fixture must align temporal state before capture |

Asset source/generated/served parity was PASS in both recorded `09:*` runs. The
City Events source fix and narrowly safe PostgreSQL pre-dispatch retry were
implemented after those runs. At that point they had targeted test coverage, but
still required a full `ui-parity` rerun before any release-verdict change. The canonical
server-market rotation, `offerIndex`, shared clear, metadata, and badge repairs
were implemented incrementally. The later `13:45`, `13:56`, and `14:06` runs
prove Market and Alliance parity for their first tested viewport, and `14:06`
also proves Bounty there. Boost was then repaired from its preserved trace. The
`14:54` rerun did not reach product parity because lobby discovery admitted a
stopped disposable server; that SQL filter is repaired, but `ui-parity-social`
still has no complete clean current-tree PASS.

The `19:59` shared-surface run improved the completed evidence to `6` PASS, but
remained a strict FAIL (`3` failed, `1` not run). Its three causes were separate:
a real tablet chat-card geometry difference, one transient Vite proxy socket reset
during authoritative load, and a Playwright chip reference invalidated by a
district-popup rerender.

The `20:28` rerun passed both whole-game batches, both City Events batches, both
district batches, and Restaurant/Pharmacy: `8` PASS, `1` FAIL, `1` NOT RUN. Its
sole Herna failure was a helper false-negative after successful click dispatch had
already opened the building panel and removed the chip.

The `20:51` follow-up validates that helper repair across both Herna batches and
completes all ten test cases: `9` PASS, `1` FAIL, no skipped case. Its only failure
is screenshot-only at `1920x1080`; normalized DOM, computed styles, bounds, focus,
and scroll already matched before the PNG comparison found `35236` meaningful
pixels with equal image dimensions. The captured dynamic Street News state could
change between stabilization and screenshot.

The first Street News stabilization attempt then produced `21:34`: `6` PASS, `2`
FAIL, `2` NOT RUN. The hosted welcome milestone could immediately repopulate the
cleared feed, while Herna exposed a distinct stale-index variant when the chip list
rerendered between matching and click.

Run `22:22` never reached browser acceptance: the old migration `vite-node` startup
timed out with exit `124` before writing a log. Migrations, admin bootstrap, and
browser-config generation are now part of the single guarded runtime bundle and
execute as prebuilt Node CLIs. That startup repair is validated by successful setup
and browser bootstrap in `22:41`, `23:12`, and `23:39`.

The `22:41` browser phase nevertheless finished `3/3/4`, not PASS. Known milestone
pre-ack plus repeated clearing did not prevent Street News from repopulating, one
parallel registration context remained disabled after another Vite proxy
`ECONNRESET`, and Herna timed out while Playwright clicked a rerendering locator.

The `23:12` run improved to `6/3/1`. It proved both district batches and
Restaurant/Pharmacy, but also showed why the previous repairs were incomplete:
local Street News repopulated to `145.297 px` while hosted remained at `100 px`, the
approximately `9 s` proxy retirement still raced a `10 s` poll and produced a load
`500`, and Herna lost its pointer target after locator resolution.

The `23:39` rerun completed at `7/2/1`. Symmetric rumor-publication pause
closes both whole-game batches, both City Events batches PASS, and the `5 s` proxy
free-socket policy produces no `500`/`ECONNRESET`. The run is still a strict FAIL:
Restaurant/Pharmacy records an explicit authoritative load `503` with PostgreSQL
code `57014`, and the Herna helper reaches and dispatches through a verified pointer
but no popup becomes visible within `1 s`; the serial second Herna batch does not
run.

The first post-midnight rerun, `00:09`, removes the earlier Herna uncertainty: both
Herna viewport batches PASS. It still completes only `5/2/3` because two browser
entries click the registration opener before the modal controller is bound, leaving
the overlay hidden. Registration now starts fail-closed (`disabled`) and the binder
enables it only after attaching the click path.

Run `00:22` fails before Playwright. `/api/servers` returns `503` because public
discovery loads the global monitoring set, including `185` stopped disposable
servers, before determining what is actually public. The repaired read model first
filters `stopped` and `archived`, then requests one scoped summary for each remaining
server. Raw browser traces are also routed through the external artifact root rather
than OneDrive; only safe runner logs remain under the worktree `.tmp` directory.

Run `00:41` reaches shared surfaces but an inherited `PLAYWRIGHT_WORKERS=2` creates
non-deterministic registration/lobby contention: four cases remain at `Načítám…`,
producing `1/4/5`. The harness now clears inherited worker overrides and therefore
uses the canonical one-worker Playwright default.

The latest `01:01` run proves the result of those infrastructure repairs: all ten
shared-surface cases PASS. It then continues into the spawn-reachable registry and
fails honestly at `2/12`. Six groups reach the card and disagree on presentation
values (Convenience Store, Apartment Block, Street Dealers, Recruitment Center,
School, and Car Dealer); four groups cannot acquire a visible production-building
chip (Factory, Armory, Pharmacy, and Drug Lab). The projection and opener defects
identified by this run are repaired in source with `41/41` and `59/59` targeted
PASS respectively, but no later browser matrix exists. Therefore `01:01` remains
the current browser verdict and both release verdicts remain NO-GO.

The filtered `13:05` follow-up supersedes the `01:01` run only for the exact
building groups it completed. It proves the production opener repair through the
visible map/chip path and closes Street Dealers and Recruitment Center across all
ten canonical viewports. It also turns the former generic projection/opening
failures into five bounded product differences listed in section 5. Because the
single Playwright group reached its `1800 s` outer deadline during Drug Lab and
never ran Car Dealer, the next verification is intentionally split into smaller
population and production batches rather than hiding the workload by blindly
raising the deadline.

The `16:32` traces then separated actual structure from capture noise. The tablet
whole-game signature was a real bounds/style failure caused by implicit tracks.
City Events (`63862` pixels), district (`32845`), and Arcade (`587`) failed only
the PNG comparison after their normalized DOM, computed styles, bounds, focus, and
scroll contracts passed. Stable shell isolation removed those failures in the
`17:37` shared-surface rerun. At that point it was not a gate PASS because whole-game
chrome has a remaining `16`-pixel mobile difference and its serial tablet batch did
not run.

## 28. Asset and cache integrity

The local hosted harness first builds one guarded runtime bundle containing the
API, worker, scenario seed, database migrations, admin bootstrap, and browser
config setup CLIs. It executes those prebuilt Node entrypoints before building the
gameplay client and admin page for browser acceptance. Browser assets are hashed as:

`source build input -> generated asset -> served asset`.

The recorded manifests, including `2026-08-01T11-05-22Z` and the preserved
`2026-08-01T14-54-16Z` bootstrap failure, reported PASS for:

- gameplay client source/generated/served equivalence;
- admin client source/generated/served equivalence;
- main CSS source/served equivalence;
- browser gameplay config source/generated/served equivalence;
- complete CSS source-tree served equivalence.

The generated bundle is rebuilt through the canonical command; it is not edited
manually.

## 29. Test classification

The harness records the suite-specific `gameplayInteraction` value below instead
of assigning the misleading blanket label `visible-browser-ui`:

| Suite/evidence | Recorded `gameplayInteraction` | Manual admin create | PostgreSQL/worker | Release interpretation |
| --- | --- | --- | --- | --- |
| `manual-admin-player` | `visible-browser-ui` | yes | yes | Manual acceptance for the exact build |
| `city-events`, `production-*`, `building-actions-visible-ui-*`, `social-visible-ui` | `visible-browser-ui` | no | yes | Visible controls, usually on a prepared authoritative world |
| `ui-parity`, `ui-parity-social`, `ui-parity-non-spawn` | `visible-browser-opening-and-observation` | no | yes | Visible opening/observation parity, not gameplay-command acceptance or manual provisioning |
| `district-selection-race` | `browser-runtime-api-and-visible-opening-observation` | no | yes | Browser/runtime API plus visible opening, not a pure UI command path |
| `income` | `browser-authoritative-state-observation` | no | yes | Browser observation of authoritative state, not a visible action flow |
| `building-actions-day/night`, `multiplayer-core` | `direct-authoritative-api` | no | yes | Command/API evidence only |
| `multiplayer-visible-actions` | `mixed-visible-browser-ui-and-parity-observation` | no | yes | Mixed visible action and presentation evidence |
| `lifecycle-stop` | `mixed-visible-admin-ui-and-direct-authoritative-api` | mixed | yes | Admin UI plus direct authoritative API evidence |
| safe SQL/tick artifacts | not a browser suite | no | yes | Runtime evidence, not browser acceptance |

This classification is intentional: no helper-created world is relabeled as a
manual admin flow.

## 30. Verification record at draft cutoff

### PASS on the current worktree

- Node 24 `npm run typecheck`: exit `0` in `28.9 s` for the latest repair set.
- Focused presentation/parity command
  `npm exec vitest run tests/unit/building-presentation-adapters.test.js tests/unit/building-presentation-contract.test.js tests/unit/runtime-district-building-data.test.js tests/unit/live-demo-ui-parity-contract.test.js tests/unit/ui-parity-capture.test.js tests/integration/district-building-slice.test.ts tests/integration/game-core/building-action-flow.test.ts`:
  `7` files, `127/127` tests PASS in `27.5 s` wall time (`23.39 s` Vitest).
- Targeted presentation/runtime group: `74/74`.
- Targeted parity/CSS/lifecycle group: `63/63`.
- PostgreSQL connection retry, local DB, safe diagnostic, and parity helper group:
  `24/24`.
- Alliance/Bounty/presentation targeted group: `47/47` at its latest focused run.
- Building cleanup/adapter/Bounty/social contract group: `39/39`.
- Runtime verifier group: `28/28` plus Node 24 typecheck.
- Production projection/integration group: `110/110`; focused explicit-zero
  follow-up: `71/71`.
- Focused production ghost-click, lazy mode-policy, direct opener, and async
  restore group: `59/59`.
- Focused six-building authoritative presentation-projection group: `41/41`.
- Current School/Factory/population/production/parity repair group: `15` files,
  `379/379` tests PASS. This includes server-authoritative School collect while
  preserving exactly `39` visible special actions, projected Factory caps/rates/
  collect reasons, stable population countdown layout, complete Armory recipe
  seed coverage, and the strict bounded PNG recapture contract.
- Deleted-stack reachability and replacement group: `20` files, `197/197` PASS
  in `84.5 s`.
- Local-hosted artifact-directory runner contract: `4/4`.
- `git diff --check`.
- Latest asset source/generated/served checks.
- Targeted prebundled non-spawn Casino browser run at
  `2026-08-01T19-39-44Z`: matrix declaration plus Casino `2/2` PASS at all ten
  canonical viewports in `7.3 m` Playwright wall time (`6.9 m` Casino case).
- Targeted authoritative Market unit suite: `29/29` PASS, covering sell capacity,
  current normal-offer enforcement, black-only rejection, command context, and
  transaction read-model redaction.
- `.tmp/local-hosted-full/2026-08-02T01-01-57Z` shared-surface phase: `10/10`
  visible-browser cases PASS under deterministic one-worker execution. This is a
  phase PASS, not an overall `ui-parity` PASS because the spawn matrix then failed.
- Strict PNG-capture helper after the bounded third-attempt change: `22/22` PASS.
  Acceptance still requires the final capture to contain exactly zero meaningful
  pixels; no tolerance, mask, baseline, or screenshot threshold was widened.
- `.tmp/local-hosted-full/2026-08-02T13-05-18Z` filtered spawn evidence: Street
  Dealers and Recruitment Center PASS at all ten canonical viewports; the shared
  production opener reaches Factory, Armory, Pharmacy, and Drug Lab through the
  visible building path. This is targeted evidence only, not a complete matrix.
- Build/check evidence on `a694821`: Node 24 typecheck, `check:node`, browser
  config check, production fixture boundary, admin page build, hosted worker
  build, generated-asset checks, and `git diff --check` PASS.

The targeted counts overlap; they are not added together as a unique test total.

### FAIL or incomplete on the current worktree

- The filtered `.tmp/local-hosted-full/2026-08-02T13-05-18Z` spawn run reached
  the outer group deadline with exit `124`: Convenience Store, Apartment Block,
  Factory, Armory, Pharmacy, and School failed for the exact bounded differences
  recorded in section 5; Drug Lab was incomplete and Car Dealer did not run. The
  follow-up is split by building family instead of blindly increasing the group
  deadline.

- The filtered `.tmp/local-hosted-full/2026-08-02T14-55-23Z` population run
  finished with exit `1` and `3/3` selected cases failed because the hosted
  worker advanced population buffers before capture while local demo remained at
  zero. Asset source/generated/served parity passed. This is a fixture temporal-
  state defect under repair, not a product PASS and not grounds to relax the
  structural/computed-style/PNG assertions.

- `npm run test:local-hosted:full -- --suite=ui-parity` at
  `2026-08-01T09-57-29Z`: FAIL, 6 passed, 2 failed, 2 did not run.
- `npm run test:local-hosted:full -- --suite=ui-parity-social` at
  `2026-08-01T10-29-37Z`: FAIL, 1 failed and 20 did not run because of a
  browser-serialization defect in the test helper; not a valid product verdict.
- `npm run test:local-hosted:full -- --suite=ui-parity-social` at
  `2026-08-01T10-37-35Z`: FAIL, 1 failed and 20 did not run after revealing the
  real mobile Market offer-count/clear-control difference.
- `npm run test:local-hosted:full -- --suite=ui-parity-social` at
  `2026-08-01T11-05-22Z`: bootstrap and asset parity PASS; social Market FAIL,
  1 of 21 failed and 20 did not run because metadata/badge/height still differed.
- `npm run test:local-hosted:full -- --suite=ui-parity-social` at
  `2026-08-01T13-45-14Z`: Market and Alliance PASS for the first viewport;
  Bounty failed and 18 cases did not run.
- The `2026-08-01T13-56-24Z` rerun again passed Market and Alliance, then failed
  Bounty width parity; 18 cases did not run.
- The `2026-08-01T14-06-04Z` rerun passed Market, Alliance, and Bounty for the
  first viewport, then timed out on the out-of-viewport Boost close control;
  17 cases did not run.
- The post-Boost `2026-08-01T14-54-16Z` rerun failed in bootstrap before social
  parity because lobby remained at `Načítám…`; the stopped-server SQL discovery
  root cause is fixed in source but has not yet completed a clean browser replay.
- The `2026-08-01T16-32-11Z` `ui-parity` run failed with `5` passed, `4`
  failed, and `1` not run; only the whole-game tablet case was a structural
  mismatch, while City Events, district, and Arcade passed DOM/style/bounds and
  failed the PNG comparison. Its non-spawn phase failed `7` cases and passed the
  matrix declaration, exposing real fixture/presentation drift now repaired in
  source.
- The preserved partial `2026-08-01T17-37-18Z` browser gate did not complete its
  later phases. Its completed shared-surface phase passed `8`, failed `1`, and skipped
  `1`: stable-backdrop City Events/district/Arcade and Restaurant/Pharmacy passed,
  but whole-game chrome retained `16` meaningful pixels at `360x800`, preventing
  the serial whole-game tablet batch from running. This is **not** a browser PASS.
- The `2026-08-01T19-13-42Z` and `2026-08-01T19-25-27Z` non-spawn attempts each
  passed bootstrap, then failed scenario setup with exit `124`; their zero-byte
  seed logs prove the old `vite-node` path timed out before module execution.
- The `2026-08-01T19-39-44Z` outer wrapper timed out only after the preserved
  Playwright log already contained the targeted `2/2` Casino PASS. That saved
  browser result is counted only as Casino evidence; the wrapper outcome and
  targeted test selection do not qualify as a complete `ui-parity-non-spawn`
  gate PASS.
- The `2026-08-01T19-59-44Z` shared-surface run completed with `6` passed, `3`
  failed, and `1` not run. The exact failures were tablet chat content geometry,
  a Vite `/api/gameplay-slice/load` `ECONNRESET`, and a district-chip rerender race
  during the Herna click. The chat repair is validated; later runs reproduced the
  proxy and chip failures before the newer fixes below.
- The `2026-08-01T20-28-03Z` shared-surface rerun completed with `8` passed, `1`
  failed, and `1` not run. Whole-game, City Events, district, and
  Restaurant/Pharmacy completed both relevant batches; the only FAIL was the
  Herna helper rejecting a vanished post-dispatch chip although screenshots show
  the resulting panel open. Both Herna batches then PASS at `20:51`; this earlier
  run remains incomplete rather than PASS.
- The `2026-08-01T20-51-23Z` shared-surface run completed all ten cases with `9`
  passed and `1` failed. Both City Events, district, Herna, and
  Restaurant/Pharmacy batches PASS. The only failure is the `1920x1080` whole-game
  PNG comparison (`35236` meaningful pixels, equal dimensions) after its
  DOM/style/bounds/scroll comparison had already passed.
- The `2026-08-01T21-34-13Z` run completed with `6` passed, `2` failed, and `2`
  not run. The failures isolate Street News welcome-entry stabilization and a
  stale Herna chip index.
- The `2026-08-01T22-22-02Z` harness attempt failed before browser execution:
  migrations exited `124` and its log stayed empty because the setup path still
  paid a `vite-node` cold start before module execution.
- `.tmp/local-hosted-full/2026-08-01T22-41-41Z` completed setup/bootstrap, then
  failed shared surfaces at `3/3/4`: Street News did not settle, a registration
  context stayed disabled after proxy `ECONNRESET`, and Herna locator click timed
  out.
- `.tmp/local-hosted-full/2026-08-01T23-12-24Z` completed at `6/3/1`: both district
  batches and Restaurant/Pharmacy PASS, while Street News geometry, another proxy
  load `500`/`ECONNRESET`, and a missing Herna pointer target failed.
- `.tmp/local-hosted-full/2026-08-01T23-39-18Z` completed at `7/2/1`: registry,
  both whole-game, both City Events, and both district batches PASS; proxy reset is
  absent. Restaurant/Pharmacy fails clean-console on API `503` / PostgreSQL `57014`,
  and Herna still fails after verified pointer dispatch because no popup appears.
- `.tmp/local-hosted-full/2026-08-02T00-09-03Z` completed shared surfaces at
  `5/2/3`: both failures are the registration-overlay pre-bind race. City Events
  and both Herna batches PASS.
- `.tmp/local-hosted-full/2026-08-02T00-22-21Z` failed before browser execution:
  `/api/servers` returned `503` while its global monitoring path traversed `185`
  stopped disposable servers. The terminal-server filter and scoped summary read
  were implemented after this failure.
- `.tmp/local-hosted-full/2026-08-02T00-41-55Z` completed shared surfaces at
  `1/4/5`; the four failures stalled in lobby under an inherited two-worker
  Playwright override. The runner now enforces the canonical deterministic worker
  count instead of inheriting that override.
- `.tmp/local-hosted-full/2026-08-02T01-01-57Z` passed shared surfaces `10/10`,
  then failed the spawn-building matrix at `2/12`. Six failures are presentation
  values for `convenience_store`, `apartment_block`, `street_dealers`,
  `recruitment_center`, `school`, and `car_dealer`; four are missing visible
  pointer targets for `factory`, `armory`, `pharmacy`, and `drug_lab` chips. Both
  root-cause groups are repaired in source with targeted PASS results, but no
  post-fix browser matrix exists, so this failure remains the latest UI evidence.
- `npm run lint`: FAIL on known file-size debt in ten unrelated/pre-existing
  files; architecture checks pass. This is not reported as lint PASS.
- A later attempted combined ten-file production test command timed out without
  usable output; it is not counted as PASS and does not invalidate the separate
  focused production runs above.
- An accidental `npm test -- ...` invocation entered the full npm suite and timed
  out with `EPIPE`; it is not a valid targeted result and not a full-suite PASS.

### Historical PASS, not final current-tree proof

- manual admin/player flow on `29b3aec`;
- tick/income and preserved PostgreSQL evidence on post-`bf53c620` builds;
- 39 command-level actions on `bf53c620`;
- Pharmacy, Drug Lab, Factory, Armory, City Events, multiplayer-core, district
  selection race, and lifecycle stop on `bf53c620`.

### NOT RUN as the final clean gate

- `npm ci` after the final worktree is committed;
- `npm run check:node`;
- `npm run generate:browser-config`;
- `npm run check:browser-config`;
- `npm run check:production-fixture-boundary`;
- full `npm test`;
- `npm run test:simulation`;
- `npm run simulate:20p:matrix`;
- `npm run simulate:liveness-soak`;
- `npm run simulate:free-br:matrix`;
- `npm run simulate:production-chain`;
- `npm run test:e2e:smoke`;
- `npm run test:e2e:full`;
- `npm run coverage:check`;
- `npm run verify:closed-alpha`;
- `npm run verify:hosted-control-plane`;
- `npm run verify:production-authority-cutover`;
- final authenticated `npm run verify:local-hosted-runtime`;
- `npm run build:admin:page`;
- `npm run build:hosted-worker`;
- full `npm run test:local-hosted:manual-full`.

## 31. Screenshots and traces

Relevant preserved evidence directories:

- `.tmp/local-hosted-full/2026-08-01T09-19-21Z` — paired parity screenshots,
  City Events failure trace, asset manifest;
- `.tmp/local-hosted-full/2026-08-01T09-57-29Z` — paired whole-game/Arcade
  screenshots, traces, API/worker logs, asset manifest;
- `.tmp/local-hosted-full/2026-08-01T10-29-37Z` — social helper serialization
  failure trace;
- `.tmp/local-hosted-full/2026-08-01T10-37-35Z` — mobile Market demo/hosted
  structural difference screenshots and trace;
- `.tmp/local-hosted-full/2026-08-01T11-05-22Z` — asset manifest, bootstrap
  evidence, and the pre-fix mobile Market metadata/badge parity trace;
- `.tmp/local-hosted-full/2026-08-01T13-45-14Z` — Market/Alliance first-viewport
  PASS evidence and the first preserved Bounty mismatch trace;
- `.tmp/local-hosted-full/2026-08-01T13-56-24Z` — repeated Market/Alliance PASS
  evidence and the isolated Bounty width trace;
- `.tmp/local-hosted-full/2026-08-01T14-06-04Z` — Market/Alliance/Bounty
  first-viewport PASS screenshots plus the mobile Boost out-of-viewport trace;
- `.tmp/local-hosted-full/2026-08-01T14-54-16Z` — post-Boost bootstrap screenshot,
  error context, and trace proving the stopped-server lobby discovery failure;
- `.tmp/local-hosted-full/2026-08-01T16-32-11Z` — paired shared-surface PNGs and
  traces separating tablet implicit-grid structure from City Events/district/
  Arcade pixel-only compositing, plus all seven non-spawn presentation failures;
- `.tmp/local-hosted-full/2026-08-01T17-37-18Z` — partial rerun evidence: passing
  stable-backdrop City Events/district/Arcade and Restaurant/Pharmacy captures,
  plus the `360x800` whole-game `16`-pixel failure trace; its non-spawn phase did
  not complete;
- `.tmp/local-hosted-full/2026-08-01T19-13-42Z` and
  `.tmp/local-hosted-full/2026-08-01T19-25-27Z` — repeated bootstrap PASS followed
  by seed exit `124`, with zero-byte seed logs proving failure before scenario
  module execution;
- `.tmp/local-hosted-full/2026-08-01T19-39-44Z` — complete safe seed checkpoints
  and preserved targeted Casino screenshots/trace/log showing `2/2` PASS at all
  ten viewports before the outer wrapper timeout;
- `.tmp/local-hosted-full/2026-08-01T19-59-44Z` — shared-surface screenshots,
  error contexts, frontend proxy log, and traces for the tablet chat geometry,
  City Events `ECONNRESET`, and Herna chip-rerender race; result `6/3/1` remains
  FAIL pending rerun;
- `.tmp/local-hosted-full/2026-08-01T20-28-03Z` — paired PASS evidence for both
  whole-game, both City Events, both district, and Restaurant/Pharmacy batches,
  plus the Herna false-negative screenshots/trace proving the building panel was
  already open; aggregate `8/1/1` remains FAIL;
- `.tmp/local-hosted-full/2026-08-01T20-51-23Z` — all ten shared-surface cases
  executed; preserved paired whole-game images and trace isolate the only failure
  to the `1920x1080` screenshot after structural equality (`9/1/0`);
- `.tmp/local-hosted-full/2026-08-01T21-34-13Z` — Street News welcome
  stabilization and stale Herna chip-index error contexts, screenshots, and traces;
  aggregate `6/2/2` remains FAIL;
- `.tmp/local-hosted-full/2026-08-01T22-22-02Z` — zero-byte migration log and
  summary recording pre-module setup exit `124`;
- `.tmp/local-hosted-full/2026-08-01T22-41-41Z` — completed summary plus preserved
  Street News settle, disabled registration, proxy reset, and Herna locator-click
  diagnostics; aggregate `3/3/4` remains FAIL;
- `.tmp/local-hosted-full/2026-08-01T23-12-24Z` — completed `6/3/1` summary,
  whole-game Street News geometry diff, City Events proxy `500`/`ECONNRESET`, and
  Herna missing-pointer screenshots/error contexts/traces;
- `.tmp/local-hosted-full/2026-08-01T23-39-18Z` — completed `7/2/1` summary; paired
  PASS evidence for both whole-game, both City Events, and both district batches,
  clean frontend proxy log, API PostgreSQL `57014` diagnostic, Restaurant/Pharmacy
  `503` console evidence, and Herna post-pointer no-popup trace;
- `.tmp/local-hosted-full/2026-08-02T00-09-03Z` — safe worktree summary/logs plus
  external-temp screenshots/traces for the registration-overlay race and both
  passing Herna batches;
- `.tmp/local-hosted-full/2026-08-02T00-22-21Z` — safe startup summary recording
  `/api/servers` `503`; no browser parity case ran;
- `.tmp/local-hosted-full/2026-08-02T00-41-55Z` — safe summary/logs plus
  external-temp lobby latency diagnostics from the two-worker run;
- `.tmp/local-hosted-full/2026-08-02T01-01-57Z` — safe summary/logs for the
  `10/10` shared-surface PASS and `2/12` spawn-matrix result; browser screenshots,
  contexts, and traces are stored under the separately recorded OS-temp artifact
  root rather than the repository;
- `.tmp/local-hosted-full/2026-07-31T19-57-10Z` — real admin-to-player browser
  trace for build `29b3aec`;
- `.tmp/manual-hosted-reproducer` — safe starting-state, tick, income, and verifier
  artifacts.

Failed-run screenshots and traces are diagnostic evidence, not golden baselines.
No screenshot baseline was blindly updated.

The harness now allocates a unique Playwright output directory for each suite and
phase and records both browser and log roots in `summary.json`. When
`EMPIRE_LOCAL_HOSTED_BROWSER_ARTIFACT_ROOT` is set, raw browser artifacts are kept
outside the repository/OneDrive tree while safe process logs remain under
`.tmp/local-hosted-full/<run>`. Thus a later phase cannot overwrite an earlier
screenshot or trace and heavy browser writes no longer share the worktree path
with the local PostgreSQL-heavy run.

## 32. Existing server vs fresh/disposable server

- The preserved problem server was captured before any destructive action.
- A later preserved server proves exact configured material balances and active
  authoritative tick/income.
- Disposable servers are created for fixture/manual acceptance and are stopped or
  archived according to suite policy.
- No starting-state replay is applied to existing players.
- The final report must add the exact current-tree comparison after the final
  manual run. Status: **PENDING**.

## 33. State retained and cleanup safety

- No PostgreSQL volume was deleted.
- No applied migration or migration history was edited.
- No user data or preserved diagnostic reproducer was deleted.
- No `git reset --hard`, broad clean, Docker system prune, or Docker volume prune
  was used.
- Untracked `.tmp/` diagnostics and `img/dizajn/` references remain outside the
  intended commit.
- No local-demo fallback was enabled in hosted mode.
- No browser-side gameplay authority or admin resource cheat was introduced.
- War, payments, and public deployment remain disabled/deferred.

## 34. Remaining P0

1. Obtain clean current-tree PASS results for `ui-parity`,
   `ui-parity-non-spawn`, and `ui-parity-social`. The latest `01:01` run proves
   shared surfaces `10/10`, including both whole-game, City Events, district,
   Restaurant/Pharmacy, and Herna batches, but its following spawn matrix is still
   the latest browser result at `2/12`. The six presentation projections and four
   production-popup handoffs are repaired with targeted evidence; rerun the
   complete, unfiltered matrix before changing their browser status. The
   prebundled non-spawn seed and Casino have targeted browser proof at all ten
   viewports, but the remaining nine non-spawn canonical types have not completed
   a clean matrix. Market/Alliance/Bounty first-viewport evidence remains
   insufficient for the full responsive matrix.
2. Rerun the real admin-create/account/lobby/faction/game flow on the final tree and
   prove configured DB/runtime/read-model/rendered equality again.
3. Complete visible Spy, Rob, Heist, Attack, and Occupy acceptance with reload and
   persistence on the final tree.
4. Complete visible Bounty, Market, and Alliance two-client flows, concurrency,
   and private-data isolation. Market capacity, rotation enforcement, and
   transaction-view redaction are implemented with `29/29` unit PASS, but still
   require two authenticated browser sessions and network-observed isolation.
5. Complete current-tree Pharmacy, Drug Lab, Factory, and Armory production
   acceptance, including restart/edge cases required by the gate.
6. Run the full `test:local-hosted:manual-full` gate and retain trace/video.

## 35. Remaining P1

1. Complete every population source/cap/no-source browser case.
2. Complete every building action's resource delta, effect persistence/expiry,
   income impact, and responsive result matrix.
3. Complete City Events reward/claim and Bounty expiry/concurrent claim matrices.
4. Complete Market expiry/restart/seller-delta and Alliance max-member/modifier
   matrices.
5. Complete archive/delete negative, replay, session-revocation, and two-new-server
   paths.
6. Run the full simulation, coverage, closed-alpha, control-plane, and production
   authority gates.
7. Refresh an already-open Market popup from each new authoritative projection.
8. Drive the normal-market refresh chip from the canonical normal rotation
   schedule, not a black-market or fallback timestamp.

## 36. Final release update template

Before converting this draft into the release report, replace the pending block in
section 2 and append:

- final commit SHA;
- clean/dirty worktree statement;
- exact final Node/npm versions;
- exact final command table with duration and exit code;
- final current-tree manual server trace;
- final screenshot/trace directory;
- remaining failures without reclassifying them as PASS;
- pushed branch/remote verification.

Until those items are present and every mandatory GO criterion passes, the honest
release status remains:

- LOCAL HOSTED SINGLE-PLAYER READINESS: **NO-GO**
- LOCAL HOSTED MULTIPLAYER READINESS: **NO-GO**
- REMOTE PUBLIC TEST READINESS: **DEFERRED**
