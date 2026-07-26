# Frontend Browser Event Contracts

## Scope and method

This audit covers every literal `empire:*` browser event produced or consumed
by the `pages/game.html` runtime:

- the 19 module roots discovered from `pages/game.html`;
- their 126 server-authoritative ESM dependencies;
- the compiled gameplay-slice client loaded at runtime by
  `liveGameplayBootstrap.js`;
- the explicit `app-demo.js -> localDemoLegacyBootstrap.js -> runtime.js`
  local-demo graph;
- the onboarding bridge that is mounted only inside the legacy local runtime.

Strings used only as storage keys, idempotency keys or debug namespaces are not
browser events. In particular, `empire:local-demo-session:v1`,
`empire:demo:execution-mode:v1`, `empire:gameplay-slice:snapshot:*` and
`empire:server-command-journal` are storage contracts, not event contracts.

The gameplay-slice bundle is a script-injection edge rather than an ESM import:

```text
app.js
  -> liveGameplayBootstrap.ensureClientScript()
    -> page-assets/js/client-assets/gameplay-slice-client.js
       (built from apps/client/src/browser/gameplay-slice-page.ts)
```

The production event guard therefore audits both the ESM graph and the
canonical gameplay-slice page source explicitly.

## Authority rule

No browser event proves identity or commits gameplay state. In
`server-authoritative` mode:

- `empire:gameplay-slice-rendered` carries an already returned authoritative
  read model;
- UI actions use the gameplay command transport;
- presentation events only coordinate DOM, canvas, modal and lifecycle state.

Legacy local mutation signals are allowed only after the explicit loopback
local-demo bootstrap has installed its bridge. The architecture check rejects
those signal producers if they become reachable from the production graph.

Legend:

- **authoritative read**: transports a server result for presentation;
- **presentation**: UI, canvas, status or lifecycle coordination only;
- **local signal**: emitted after a local-demo/onboarding mutation; never a
  production authority mechanism;
- **compatibility**: one side is intentionally absent from the production graph.

## Server-authoritative and shared contracts

| Event | Producer | Consumer | `detail` contract | Modes | Class |
| --- | --- | --- | --- | --- | --- |
| `empire:gameplay-slice-rendered` | `apps/client/src/browser/gameplay-slice-page.ts`; immediate command path in `runtime/serverGameplayCommandTransport.js` | presentation source, live gate, alliance, bounty, city events, milestone, status UI | `{ gameplaySlice, playerView, connection?, renderState? }` | server-authoritative; local consumers may ignore | authoritative read |
| `empire:gameplay-connection-state` | gameplay-slice page | page controller, live gate, closed-alpha status | connection read model (`status`, `lastErrorMessage`, `staleData`, timestamps) | server-authoritative | presentation |
| `empire:runtime-mode-changed` | `performance/runtimePerformanceDiagnostics.js`; local bootstrap during destroy | alliance, boost, city events, city status; legacy runtime in local demo | performance summary plus `reason`, or `{ runtimeMode, reason }` during local cleanup | both | presentation/lifecycle |
| `empire:mobile-performance-mode-changed` | `mobile-performance-runtime.js` | city status; city-events local timer manager; legacy map in local demo | detected mode (`active`, viewport/pointer flags, DPR and FPS caps) | both | presentation/performance |
| `empire:settings-changed` | `runtime/settingsState.js` | server map controller; legacy map in local demo | `{ settings }` with normalized language, borders, alliance symbols and visibility | both | presentation |
| `empire:district-closed` | `ui/districtPopupModalHelpers.js` | compiled gameplay-slice page | `{ source: "legacy-district-popup" }` | server-authoritative | presentation |
| `empire:open-bounty-modal` | server leaderboard controller; bounty shortcut/global bridge | `bounty-runtime.js` | optional `{ source, targetPlayerId }` | both | presentation |
| `empire:alliance-state-changed` | alliance runtime after server read-model update or guarded dev update | legacy map/profile consumers only | currently no required payload | both; no production mutator consumes it | compatibility/presentation |
| `empire:bounty-state-changed` | bounty runtime after publishing its current read model | legacy map only | bounty read model | both; no production mutator consumes it | compatibility/presentation |
| `empire:conflict-state-stale` | server command transport after a stale conflict rejection | no in-repository game-page consumer | `{ commandId, errors }` | server-authoritative | compatibility/diagnostic |
| `empire:map-transform-changed` | `map-navigation.js` | legacy map renderer only | `{ scale, x, y }`, bubbling from viewport | both; production map uses direct transform state | compatibility/presentation |
| `empire:city-events-opened` | city-events modal controller | no in-repository consumer | `{ open: true }` | both | compatibility/presentation |
| `empire:city-events-agent-selected` | city-events modal controller | no in-repository consumer | `{ agentKey, agentName }` | both | compatibility/presentation |
| `empire:onboarding-event` | alliance modal; local trap flow | onboarding bridge only | typed onboarding payload, e.g. `{ type: "alliance:opened" }` | producer reachable in both; consumer local/onboarding only | compatibility/presentation |
| `empire:server-milestone-open` | legacy result router | final-lockdown popup runtime | `{ milestoneId, payload }` | local-demo compatibility; server mode opens from read model directly | compatibility/presentation |
| `empire:street-news-publish` | final-lockdown popup runtime | legacy street-news feed only | `{ snapshot }` | both producer; local-demo consumer | compatibility/presentation |
| `empire:building-opened` | legacy district building flow | window-restore runtime; onboarding bridge | `{ districtId, buildingName }` | local-demo/onboarding producer; shared compatibility consumer | compatibility/presentation |
| `empire:bounty-action-resolved` | legacy attack/occupy completion | bounty runtime, which explicitly ignores it for claims | action and source/target district identifiers plus local result fields | local-demo producer; shared defensive consumer | compatibility/local signal |
| `empire:gang-state-changed` | legacy local gang setters | alliance eligibility plus legacy status/profile consumers | no required payload | local-demo/onboarding producer | compatibility/local signal |
| `empire:player-boost-state-change` | legacy local boost activation/consumption | boost presentation runtime | `{ boostId, source }` | local-demo producer; shared presentation consumer | compatibility/local signal |
| `empire:onboarding-alliance-reset` | legacy onboarding sandbox activation | alliance presentation runtime | `{ allianceBoard }` | onboarding-sandbox inside local runtime | compatibility/presentation |
| `empire:local-demo-gameplay-bridge-ready` | explicit local-demo bridge installation | boost presentation runtime | no payload | local-demo only; producer module is inert until install | lifecycle |

## Local-demo and onboarding-only contracts

| Event | Producer | Consumer | `detail` contract | Class |
| --- | --- | --- | --- | --- |
| `empire:action-result` | legacy result renderer | onboarding and police presentation bridges | `{ kind, payload, snapshot }` | local signal/presentation |
| `empire:attack-started` | legacy local attack handler | onboarding bridge | `{ sourceDistrictId, targetDistrictId, order }` | local signal |
| `empire:occupy-started` | legacy local occupy handler | onboarding bridge | `{ sourceDistrictId, targetDistrictId, order }` | local signal |
| `empire:robbery-started` | legacy local robbery handler | onboarding bridge | `{ sourceDistrictId, targetDistrictId, order }` | local signal |
| `empire:spy-started` | legacy local spy handler | onboarding bridge | `{ sourceDistrictId, targetDistrictId, mission }` | local signal |
| `empire:economy-state-changed` | local authority-session economy setter | legacy wanted/profile/gang UI | no required payload | local signal |
| `empire:world-state-changed` | legacy world/district setters | legacy map/profile/gang UI | ownership-change flags and optional neutralized district IDs | local signal |
| `empire:police-state-changed` | legacy police marker/state setters | legacy map, wanted, profile and gang UI | optional `{ districtId, marker }` | local signal |
| `empire:heat-changed` | legacy gang Heat setter | onboarding and police presentation bridges | `{ previousHeat, heat, delta, reason }` | local signal |
| `empire:production-state-change` | local production clock and boost side effects | local factory/production popup renderers | `{ source }` | local signal |
| `empire:production-collected` | local production/factory collectors | onboarding and legacy refresh handlers | typed collection payload with `source` and collected context | local signal |
| `empire:player-boost-lifecycle` | local boost expiry/activation journal | no in-repository browser consumer | lifecycle entry | local signal/diagnostic |
| `empire:elimination-resolved` | local elimination purge panel | no in-repository browser consumer | local elimination result | local signal |
| `empire:district-opened` | legacy map district flow | onboarding and rumor presentation bridges | district object/id, ownership flag and popup context | presentation |
| `empire:result-modal-opened` | legacy result modal queue | rumor presentation bridge | `{ kind, payload }` | presentation |
| `empire:runtime-refresh` | legacy full UI refresh | local popup, onboarding, police, gang and rumor renderers | `{ state }` | presentation/lifecycle |
| `empire:police-feedback` | local police presentation bridge | onboarding bridge | `{ heat, riskKey, message, fallback }` | presentation |
| `empire:police-raid-acknowledged` | local police fallback/global compatibility API | no in-repository browser consumer | `{ raidId, fallback: true }` | compatibility |
| `empire:map-invalidate` | no in-repository producer | legacy map renderer | optional layer/reason detail interpreted by the legacy renderer | compatibility/presentation |
| `empire:buildings-popup-opened` | legacy buildings popup | no in-repository consumer | `{ open: true }` | compatibility/presentation |

## Findings

1. No production-reachable consumer uses an `empire:*` event to change cash,
   Heat, district ownership, inventory, production, police, bounty or alliance
   authority. Server commands remain the only production mutation path.
2. `runtime.js` is the producer of almost all local gameplay signals and is
   reachable only through the explicit local-demo graph.
3. The shared boost runtime previously treated every non-server mode as local
   demo. It now resolves the local bridge only for the exact `local-demo` mode,
   so `unavailable` and `onboarding-sandbox` fail closed.
4. The bounty dev fallback previously required loopback plus an installed
   bridge but did not also require the exact local-demo mode. It now requires
   all three conditions.
5. Several one-sided compatibility events remain in the production source
   graph (`map-transform-changed`, `street-news-publish`,
   `city-events-opened`, `city-events-agent-selected`,
   `conflict-state-stale`). They have no production gameplay mutator and are
   safe, but are candidates for later removal after external/debug consumers
   are ruled out.

## Automated guard

`auditForbiddenBrowserEventDispatches()` in
`scripts/production-game-import-graph.mjs` scans literal `dispatchEvent(new
CustomEvent(...))` calls in:

- every production ESM module reachable from `pages/game.html`;
- `apps/client/src/browser/gameplay-slice-page.ts`.

`scripts/check-production-fixture-boundary.mjs` fails if that graph starts
publishing any known legacy local gameplay event. The allowlist is deliberately
not based on file names, so moving a local mutation signal into a new
presentation module does not bypass the check.
