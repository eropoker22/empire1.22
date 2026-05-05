# Free Session Readiness

Date: 2026-05-06

## Status

Status: ready for MVP free-session click loop.

The free-session MVP has now passed a real browser click-through using `scripts/free-session-ux-pass.mjs` against `http://127.0.0.1:5174/pages/game.html`. The pass verified boot, FREE session state, owned district, building detail, production/action click, storage, equipment path, adjacent enemy district, spy report, timed attack report, police feedback, neon police-threat stars, and onboarding completion.

The latest police sprint moved police trigger/lifecycle/consequences into core/config. Attack, spy, production, market, district ownership, map geometry and win-condition rules were not changed.

Police balance follow-up: `docs/audits/police-balance-free-session.md` now covers deterministic 120 minute free-session simulations. Verdict is `good` for MVP balance: quiet play is safe, normal play gets warnings, aggressive/dirty/snowball play gets real pending raids without open-raid spam.

Rumors/city feed follow-up: `docs/audits/rumors-city-feed-integration.md` adds a shared `CityFeedEvent` read model, core feed storage/projection, config-backed rumor templates, and a legacy runtime bridge. Attack, spy, capture, trap, police warning, and police raid events can now surface as city feed entries without changing gameplay outcomes.

## Current Functional Coverage

- Player/session bootstrap: covered by `saveLoginStep/saveLobbyStep` tests for FREE mode.
- Start/owned district: covered by lobby state and runtime recovery from existing `registration.startDistrictId`.
- Map/district API: public `selectDistrict/openDistrict` and runtime district API wrappers exist.
- Building detail: public `openBuildingDetail` delegates to existing runtime UI and falls back to first owned district when possible.
- Production collect: public `collectProduction` uses existing collect buttons and safe false return when unavailable.
- Storage/resources refresh: existing refresh pipeline is kept; onboarding listens to storage/action/runtime refresh events.
- Craft/equipment: public `craftItem` safely starts the first enabled existing craft control.
- Enemy district: public open/selection wrappers support direct district id flow.
- Spy/attack: public panel/start handlers delegate to existing validation and action code.
- Battle report: partial payloads now render fallback rows.
- Heat/wanted/police: wanted panel remains; police feed now reads `PoliceReadModel` first and falls back to legacy heat only when the core projection is missing.
- Rumors/city feed: `GameplaySliceView.cityFeed` exposes current, global, selected-district, and police feed slices; static free runtime shows core feed first and local fallback rumors second.
- Police balance: free mode uses a police override with warning threshold `30`, high raid threshold `115`, extreme threshold `180`, one-minute pending TTL, and 30-minute raid cooldown.
- Manual browser pass: onboarding reached `10/10`; spy and attack timers completed; no page console errors were captured.
- Demo/dev: default preview phase remains `live`; demo scenarios are not removed.

## Known Gaps

- Static legacy free page attack reports still show `HEAT GAINED +0` unless existing attack payload data contains `heatAdded` or boost heat. Core attack handlers do add police heat; this gap is legacy/core snapshot integration, not a UI crash.
- Pending raid acknowledge still needs a real browser command transport path where server authority is present.
- `craftItem(recipeId)` cannot target a specific recipe id because recipe cards do not expose stable recipe-id DOM attributes yet; it safely starts the first enabled craft path.
- `bindDistrictCanvas` remains the highest-risk runtime block and was not refactored.

## Verification

Passed:

- `npm run typecheck`
- `npm run smoke:ui`
- `npm run lint:architecture`
- `npm run lint:file-sizes`
- `npm run test:unit` - latest city-feed sprint result: 98 files, 359 tests.
- `npm run test:integration` - 14 files, 86 tests.
- `npm run test:read-models`
- `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\unit\game-core\core-police-system.test.ts tests\unit\runtime-police-bridge.test.js tests\unit\game-core\authoritative-gameplay-rules.test.ts`
- `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\unit\game-core\police-free-session-simulation.test.ts`
- `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\integration\game-core\stabilization-critical-flow.test.ts`
- `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\unit\freeSessionMvpFlow.test.js tests\unit\runtime-compatibility.test.js tests\unit\runtime-result-payload-builders.test.js tests\unit\runtime-battle-report-panel.test.js tests\unit\runtime-wanted-panel.test.js tests\unit\runtime-free-session-checklist.test.js`
- `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\unit\game-core\police-free-session-simulation.test.ts tests\unit\game-core\core-police-system.test.ts tests\unit\runtime-police-bridge.test.js tests\read-models\police-read-model.test.ts`
- `node scripts\free-session-ux-pass.mjs --url=http://127.0.0.1:5174/pages/game.html --timeout-ms=110000`

Targeted onboarding/runtime result: 3 files, 11 tests passed.
Targeted unit result: 6 files, 25 tests passed.
Full post-police unit result: 95 files, 351 tests passed.
Police balance targeted result: 4 files, 15 tests passed.
Rumors/city feed targeted result: 3 files, 8 tests passed.
Manual UX pass result: onboarding `10/10`, spy report visible, attack report visible, police feed extreme fallback visible, gang stars neon police threat active.

## Manual Checklist

1. Open game page.
2. Enter FREE mode.
3. Verify onboarding panel is visible and can minimize/hide.
4. Click owned district.
5. Open first building.
6. Collect production.
7. Open storage and verify resources refresh.
8. Craft or prepare basic equipment.
9. Click enemy district.
10. Start spy.
11. Start attack.
12. Read battle report.
13. Verify heat/wanted panel.
14. Verify police feed and last message.
15. Verify map/UI refresh after actions.
16. Verify demo mode is inactive in normal free flow.
