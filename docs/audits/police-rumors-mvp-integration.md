# Police Rumors MVP Integration

Date: 2026-05-05

## Current State

Status: ready for core police read-model consumption; city feed MVP is now integrated as a separate read model.

Police state is now core-first for heat pressure, raid warnings, pending raids and raid outcomes. Rumor and district-info systems can consume the read model without browser-side police calculations.

## Integration Notes

- Source of truth: `packages/game-core` police state and `PoliceReadModel`.
- Frontend path: gameplay slice returns `player.police` and `police`.
- Police feed path: `PoliceReadModel.policeFeed` contains recent `PoliceEvent` entries.
- City feed path: `GameplaySliceView.cityFeed` contains visible `CityFeedEvent` entries generated from police warnings, pending raids, and resolved raids.
- Rumor-safe fields:
  - `riskTier`
  - `aggregatePressure`
  - `hottestDistrictId`
  - `hottestDistrictHeat`
  - `pendingRaid`
  - `lastPoliceEvent`
  - `recommendedAction`
- Runtime fallback remains only for legacy sessions missing the core read model.

## What Changed

- Medium pressure creates a warning event, not a raid.
- High/extreme pressure creates a pending raid with preview consequences.
- Pending raids can be acknowledged, resolved or expired.
- Raid resolution emits a police event that can be shown in police feed or rumor surfaces.
- District heat now contributes to player police risk through aggregate pressure.

## Rumor Integration

- Rumor copy is authored in `packages/game-config/src/rumorTextTemplates.ts`.
- Core events are converted to feed events in `packages/game-core/src/rules/events/cityFeedEventGenerator.ts`.
- Runtime `eventRumorBridge` reads core city feed first and uses local fallback only for static/free sessions without a server projection.
- Police category city events can appear in the city feed while the dedicated police panel continues to render `PoliceReadModel`.

## Remaining Gaps

- Browser manual pass still needs to verify feed ordering after real attack/spy/raid actions.
- Legacy market/heist `rumors` arrays are not yet fully migrated into `CityFeedEvent` storage.
- Faction/alliance visibility is projection-ready but only partial until generated events carry those ids.

## Verification

Covered by:

- `tests/unit/game-core/core-police-system.test.ts`
- `tests/unit/game-core/city-feed-event-generator.test.ts`
- `tests/read-models/police-read-model.test.ts`
- `tests/unit/runtime-police-bridge.test.js`
- `tests/unit/runtime-event-rumor-bridge.test.js`
- `tests/unit/runtime-rumor-feed-panel.test.js`
- `npm run typecheck`
- `npm run test:read-models`
- `npm run test:unit`
- `npm run test:integration`
