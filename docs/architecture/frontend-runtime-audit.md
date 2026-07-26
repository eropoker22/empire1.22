# Frontend Runtime Audit

## Authority entrypoints

`pages/game.html` loads the shared data modules, the standalone presentation
surfaces, and `page-assets/js/app-entry.js`.

`app-entry.js` is the only authority switch:

- `server-authoritative` is the default and loads `page-assets/js/app.js`;
- `local-demo` loads `page-assets/js/app-demo.js` only when the loopback gate is
  explicitly enabled;
- `onboarding-sandbox` remains a separate restricted mode and does not activate
  the local gameplay bridge.

Public hosts cannot enable local demo through a query parameter or stale browser
storage.

## Server-authoritative path

The production dependency direction is:

```text
pages/game.html
  -> app-entry.js
    -> app.js
      -> serverAuthoritativePageController
        -> gameplayPresentationCoordinator
          -> serverGameplayUiController
          -> serverMapPresentationController
        -> serverGameplaySource
          -> mounted gameplay-slice client
            -> /api/gameplay-slice/load
            -> /api/gameplay-slice/submit
```

The page controller mounts once, subscribes once, and destroys its controllers
and source listeners on `pagehide`. Presentation controllers receive a read
model and command adapter; they do not calculate gameplay outcomes or persist an
authoritative local state.

The mounted gameplay-slice client derives player authority from the validated
gameplay session on the server. Browser `playerId`, `accountId`, and snapshot
tokens are not identity proof.

Command responses are committed immediately. A monotonically increasing client
operation sequence prevents an older polling response from replacing a newer
command response. Stable polling uses its own 10-second constant, permits one
request at a time, pauses while the page is hidden, performs one refresh on
return, and resets bounded exponential backoff after success.

## Map presentation

`serverMapPresentationController.js` owns the production map lifecycle. It
preserves the existing five-canvas composition and visual order:

1. static;
2. state;
3. selection;
4. effects;
5. hover.

The controller compares stable map-specific fingerprints and invalidates only
the affected layers. Static geometry is not invalidated by cash, countdown, or
unchanged polling data. The effect RAF draws only the effects canvas, stops when
no live effect remains, and is cancelled while the document is hidden.

## Local-demo path

The explicit development dependency direction is:

```text
pages/game.html
  -> app-entry.js
    -> app-demo.js
      -> localDemoLegacyBootstrap
        -> runtime.js
        -> localDemoGameplayBridge
```

`localDemoLegacyBootstrap.js` is the only allowed importer of the root
`runtime.js`. It verifies loopback access and explicit activation, rejects a
root already mounted by the server-authoritative controller, installs the local
mutation bridge, and removes the bridge plus every runtime-owned timer, RAF,
listener, and autosave hook during cleanup.

`runtime.js` remains a local-demo compatibility runtime. It is not a production
module and is deliberately excluded from the generated publish output.

## Import-time side effects

Before this extraction the production `app.js -> render-ui.js -> runtime.js`
chain evaluated the legacy runtime and registered scenario/storage/global
compatibility state before the production authority bootstrap completed.
Runtime bootstrap could then attach legacy listeners, intervals, autosave, and
RAF ownership.

The production path now imports only presentation, map, UI, source, and command
adapter modules. Importing `app.js` does not start a local simulation, load the
local-demo authority store, or install local mutation handlers.

Standalone presentation roots in `game.html` may bind their own modal/UI
lifecycles, but gameplay mutation events are routed through the
server-authoritative command adapter unless the explicit local-demo bridge is
installed.

## Event boundary

Presentation events such as district selection, modal lifecycle, settings
changes, visibility changes, and `empire:gameplay-slice-rendered` may coordinate
DOM and canvas state.

Events that would mutate cash, Heat, ownership, production, inventory, police,
market, bounty, or alliance state are not an authority mechanism in production.
The production UI submits the existing gameplay command and renders the
returned read model. Local-demo compatibility events are installed and consumed
only behind the loopback-only local-demo adapter.

## Architecture guards

`scripts/production-game-import-graph.mjs` parses static imports, export-from
edges, and statically named dynamic imports. It:

- skips `app-demo.js` only when the edge is structurally inside the explicit
  `CLIENT_EXECUTION_MODES.localDemo` branch;
- rejects direct or transitive production imports of `runtime.js`;
- rejects computed dynamic imports that cannot be audited;
- rejects production dependencies on local-demo storage, fixtures, and
  stateful bootstrap modules while allowing the inert presentation bridge;
- allows `runtime.js` only from `localDemoLegacyBootstrap.js`.

`npm run lint` executes this graph check through
`check:production-fixture-boundary`. `scripts/build-netlify-client.mjs` also
removes `app-demo.js`, `render-ui.js`, `runtime.js`, the local-demo adapter, and
development fixtures from `client/`, then fails if any forbidden path remains.

Measured with the same parser against baseline commit `2899d91`, the production
`game.html` graph reached 198 modules and 3,173,199 bytes of source JavaScript
when the legacy runtime edge was allowed. The final graph contains 19 roots,
128 reachable modules, 1,595,384 bytes of source JavaScript, and zero
legacy-runtime or local-gameplay-event violations. These are uncompressed
source-graph bytes, not invented bundle or transfer-size numbers.

## Generated output

`client/` is generated publish output and is not canonical source. Run
`npm run build:admin:page` after source changes. The build recreates `client/`
from routed pages and approved static assets, then verifies the required files
and production exclusions.

## Remaining legacy debt

- `runtime.js` still contains local-demo simulation and compatibility UI code.
  It measured 15,461 lines / 597,056 source bytes at baseline and 15,236 lines /
  583,826 source bytes after the safe extractions (line-ending-aware UTF-8
  source measurements).
- The small `window.EmpireGameplaySliceClient` port remains as an explicit
  compatibility boundary between the compiled thin client and static page
  controllers.
- Some `empire:*` presentation events remain because standalone page surfaces
  share existing DOM contracts.
- Browser `legacy-page` package copies remain for the explicit local demo.

These items do not place `runtime.js` in the production import graph. The graph
guard and publish exclusions prevent that dependency from returning silently.
