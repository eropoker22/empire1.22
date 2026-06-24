# Legacy Runtime Guard

`pages/game.html` still loads the legacy canvas runtime for map rendering and older modal previews. Authoritative gameplay mutations must not complete there when the gameplay slice client is ready.

Current guards:

- `runtime.js` checks `isServerAuthoritativeGameplayRuntimeReady()`.
- legacy robbery confirmation returns before local gang, order, loot, heat or report mutation.
- legacy defense setup returns before local weapon inventory or district defense loadout mutation.
- server-fed district panel buttons dispatch typed commands through `/api/gameplay-slice/submit`.

Allowed legacy behavior:

- render canvas and previews,
- open informational modals,
- show pending/toast state,
- show the latest server response.

Disallowed legacy behavior:

- local robbery outcome as source of truth,
- local defense loadout as source of truth,
- client-forced loot/outcome/report payloads,
- local ownership/resource mutation when server-authoritative runtime is ready.
