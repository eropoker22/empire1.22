# Rumor Pipeline

Empire Streets uses one server-authoritative city feed pipeline. Rumors are not generated in the browser and the markdown content library is not parsed at runtime.

## Runtime Flow

1. Gameplay code emits a `CoreEvent` or a typed manual feed input.
2. `packages/game-core/src/rules/events/cityFeedEventGenerator.ts` maps the gameplay event to a minimal feed input.
3. `packages/game-core/src/rules/events/rumorPipeline.ts` projects the input into a `SafeRumorSignal`.
4. The pipeline decides eligibility, audience, confidence, expiration, priority, and deterministic template selection.
5. The resulting `CityFeedEvent` is stored in `state.cityFeedEventsById`.
6. `packages/game-core/src/projections/city-feed-projection.ts` filters and orders feed views for `currentPlayerFeed`, `globalCityFeed`, `selectedDistrictFeed`, `policeFeed`, and `allianceFeed`.
7. The client renders only the server read-model.

The content source remains `docs/content/empire-streets-rumor-library.md`. The runtime registry is `packages/game-config/src/rumorContentRegistry.ts`.

## Security Boundary

The pipeline must never pass raw gameplay state into text templates. Templates receive only safe placeholders:

- `{districtName}`
- `{zoneName}`
- `{playerName}`
- `{allianceName}`
- `{marketCategory}`

`SafeRumorSignal` may contain only bands, direction, category, audience, confidence, public ids, and timing. It must not contain exact population, attack or defense power, weapon inventories, money amounts, command payloads, exact private heat, hidden spy results, RNG values, success percentages, cooldowns, or trap data.

Trap data is a hard stop. Rumor projectors must not read trap state, template context must not contain trap values, and any input with trap source/type/key/text is suppressed before materialization.

## Confidence

The runtime confidence values are:

- `confirmed`: public or already resolved event.
- `credible`: strong real signal with safe details removed.
- `suspicion`: weak real signal with multiple possible explanations.
- `rumor`: distorted or distant interpretation of a real signal.
- `false_possible`: low-quality lead that may be wrong.

False leads are deterministic and server-side. Refreshing the client must not change confidence or selected text.

## Audience

Audience is resolved before visibility:

- `current_player`: private player-relevant feed.
- `alliance`: shared alliance feed for members only.
- `selected_district`: local district feed.
- `global_city`: public city feed.
- `police`: police feed for confirmed police activity.

Filtering happens in the read-model. The browser must not receive other players' private feed items and hide them locally.

## Buildings As Sources

Building rumors are mapped by `createPassiveBuildingRumorInput` and `mapBuildingRumorCategory`:

- Restaurant: population movement, local economy, ordinary street signals.
- Convenience store: fresh local movement, deliveries, suspicious customers, espionage suspicion.
- Strip club: scandals, social influence, money, alliance and downtown hints.
- VIP lounge: high-quality downtown, strong-player, and operation signals.
- Lobby club: political, alliance, coordination, and pressure signals.
- Magistrate: police heat, raids, and civic pressure.
- Central bank: anonymized economic and laundering pressure.
- Stock exchange: market trend and aggregate demand.

Multiple matching buildings should improve coverage or quality, not create linear spam. The pipeline also applies recent-template suppression and category cooldowns.

## Expiration And Ordering

Each materialized rumor has:

- `createdAtTick`
- `expiresAtTick`
- `freshness`
- `priority`

Expiration comes from the selected template and mode multiplier in `RUMOR_FEED_CONFIG`. Freshness is recomputed in the projection. Ordering is deterministic: higher priority first, then newer tick, then stable id. Atmosphere items use very low priority and must not displace critical gameplay events.

## Dedupe And Retries

Idempotency is based on `sourceEventId + audience + category`. Re-delivered events do not create duplicate feed entries. The selected `templateId` is persisted on the event, so refreshes and read-model rebuilds keep the same text.

## Adding A Template

1. Add the source text to `docs/content/empire-streets-rumor-library.md`.
2. Regenerate or update `packages/game-config/src/rumorContentRegistry.ts`.
3. Give every template a stable id, category, confidence, allowed audiences, allowed source buildings, safe placeholder usage, expiration, and priority.
4. Run `validateRumorTemplates()` through the unit tests.

Do not put security logic in markdown. Markdown is content source only.

## Adding A Projector Mapping

1. Add the domain event mapping in `cityFeedEventGenerator.ts` or the relevant building feed adapter.
2. Strip exact values before calling the rumor pipeline.
3. Convert quantities to `low`, `medium`, or `high`.
4. Set audience explicitly when the signal is local, private, or alliance-scoped.
5. Add tests for security serialization, audience filtering, determinism, expiration, and retry idempotency.

Successful spy results stay private to the spy system. Failed or detected spy activity may create only safe counterintelligence rumors. Rumors are a pointer for attention; spying remains the source of precise intelligence.
