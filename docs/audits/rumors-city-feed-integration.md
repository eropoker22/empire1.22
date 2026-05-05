# Rumors + City Feed Integration

Date: 2026-05-06

## Status

Status: partial, MVP integrated.

City Feed now has a shared `CityFeedEvent` contract, core storage on `NormalizedGameState.cityFeedEventsById`, server gameplay-slice projection, deterministic idempotency by `sourceEventId`, config-backed rumor templates, and a legacy/free runtime bridge that displays core feed first and uses local UI fallback events only when no server projection is available.

Gameplay outcomes were not changed. The sprint only adds feed/read-model data and UI rendering.

## Phase 1 Audit

Existing pieces:

- Core event sources already existed for attack, capture, spy, trap, building action, police warning and police raid events.
- Core/server generic `eventsById` existed but was scheduler-oriented, not a player-facing city feed.
- Old market/heist systems had `rumors` arrays and `eventLog`, but they were not the shared frontend read model.
- Runtime already had `eventFeedPanel.js` for "Ulicni zpravy" action results.
- Runtime had dev-only district gossip through `districtGossipRuntime.js`.
- Police UI had `PoliceReadModel.policeFeed` through `policeHeatBridge.js` and `policeFeedPanel.js`.

Missing before this sprint:

- No shared `CityFeedEvent` model.
- No single city-feed projection for frontend.
- No idempotent feed storage for core command/tick events.
- No config-owned rumor templates.
- No runtime bridge that reads core city feed first.
- District-specific rumor UI only existed in dev/demo gossip mode.

Safe MVP scope:

- Generate feed entries from existing domain events after command/tick completion.
- Store only UI-safe feed data.
- Keep old runtime action-result feed intact.
- Add legacy runtime fallback rumors without applying gameplay effects.

## City Feed

Source of truth:

- Shared type: `packages/shared-types/src/entities/city-feed-event.ts`
- Core storage: `NormalizedGameState.cityFeedEventsById`
- Core generation: `packages/game-core/src/rules/events/cityFeedEventGenerator.ts`
- Manual/core helper factories: `packages/game-core/src/rules/events/cityFeedManualEvents.ts`
- Server projection: `packages/game-core/src/projections/city-feed-projection.ts`
- Gameplay slice path: `GameplaySliceView.cityFeed`

Storage:

- Keeps the latest `50` feed events by default.
- Dedupe key is `sourceEventId` first, event `id` second.
- Projection returns `currentPlayerFeed`, `globalCityFeed`, `selectedDistrictFeed`, and `policeFeed`.

## Rumors

Templates live in `packages/game-config/src/rumorTextTemplates.ts`.

Generated from:

- attack result,
- spy result as vague unconfirmed rumor,
- district capture,
- trap trigger,
- police warning,
- pending/resolved police raid,
- significant building action,
- manual helper support for black market and robbery events.

Truthiness:

- `confirmed`: capture, trap, police raid/warning, attack result.
- `unconfirmed`: spy, black market, robbery, significant noisy economy action.
- `false_possible`: modeled in the shared type for later rumor uncertainty, not yet emitted by MVP generators.

## Visibility

Supported:

- `all`: visible to all players.
- `player`: visible when `playerId` or `targetPlayerId` matches the viewer.
- `admin`: hidden unless projection gets `includeAdmin`.

Partial:

- `faction` and `alliance` are implemented as projection filters when payload carries `factionId` or `allianceId`, but current generated events do not yet populate those fields consistently.

Spy privacy:

- Global spy rumors use only a vague public payload.
- Exact spy details such as detected defense are not copied into global city feed payloads.

## UI

Runtime files:

- `page-assets/js/app/ui/rumorFeedPanel.js`
- `page-assets/js/app/runtime/eventRumorBridge.js`

Behavior:

- Runtime reads core `cityFeed` / `cityFeedEventsById` first.
- Legacy fallback records local action-result rumors in `localStorage` under `empireStreets.cityFeed.v1`.
- Fallback dedupes by deterministic runtime source key.
- Selected district popup can show last district-specific feed items in the existing `district-popup-gossip` panel.
- Battle report gets a small note: "Město o tom začne mluvit."
- Police category city events are available separately from `PoliceReadModel.policeFeed`; runtime police panel still primarily uses the police read model.

## Tests

Passed:

- `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\unit\game-core\city-feed-event-generator.test.ts tests\unit\runtime-rumor-feed-panel.test.js tests\unit\runtime-event-rumor-bridge.test.js`
- `npm run typecheck`
- `npm run smoke:ui`
- `npm run lint:architecture`
- `npm run lint:file-sizes`
- `npm run test:unit` - 98 files, 359 tests.

Not run:

- Browser manual click-through for attack/spy/raid feed ordering. The automated runtime smoke and unit suite passed, but visual ordering in a live browser should still be checked with the manual checklist.

## Manual Checklist

1. Make an attack success.
2. Make an attack fail.
3. Capture a district.
4. Trigger police warning.
5. Trigger raid.
6. Run spy.
7. Verify global rumor feed.
8. Verify district rumor feed.
9. Verify police feed/read model still works.
10. Verify exact spy data is not global.
11. Refresh page and confirm rumors do not duplicate.
12. Confirm console has no fatal errors.
