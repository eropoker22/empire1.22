# Legacy Runtime Guard

`pages/game.html` still loads the legacy canvas runtime for map rendering, local pre-alpha gameplay, and older modal shells. The checked-in static page declares `local-demo`; it is not production authority.

The single execution-mode resolver is `page-assets/js/app/runtime/gameplayExecutionMode.js`:

- `local-demo` allows explicitly marked browser-local gameplay.
- `server-authoritative` allows server read models and commands and disables local mutation paths.
- `unavailable` runs neither authority.

An explicit server mode never falls back to local demo. A production page without a production-ready identity/session/gameplay runtime must fail closed.

Current guards:

- `runtime.js` checks `isServerAuthoritativeGameplayRuntimeReady()`.
- demo systems also check the centralized execution mode.
- legacy robbery confirmation returns before local gang, order, loot, heat or report mutation.
- legacy defense setup returns before local weapon inventory or district defense loadout mutation.
- server-fed district panel buttons dispatch typed commands through `/api/gameplay-slice/submit`.

Allowed legacy behavior:

- render canvas and previews,
- mutate local demo state only while execution mode is explicitly `local-demo`,
- open informational modals,
- show pending/toast state,
- show the latest server response.

Disallowed legacy behavior:

- local robbery outcome as source of truth,
- local defense loadout as source of truth,
- client-forced loot/outcome/report payloads,
- local ownership/resource mutation when server-authoritative runtime is ready.
- running Demo Events, Demo chat, Factory demo boosts, or local production beside server authority.
