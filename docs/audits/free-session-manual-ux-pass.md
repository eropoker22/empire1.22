# Free Session Manual UX Pass

Date: 2026-05-06

## Verdict

Status: ready for MVP free-session click loop. The browser pass is now a validation gate, not only a diagnostic script.

The browser page at `http://127.0.0.1:5174/pages/game.html` was loaded through a real headless Chromium/Edge session using `scripts/free-session-ux-pass.mjs`. The script seeds an isolated FREE session in a temporary browser profile, then uses the same public handlers and DOM controls a player uses.

## Passed Flow

- FREE session booted on `free-eu-01`.
- Demo mode was inactive.
- Player had faction `mafian`, start district `27`, and one owned district.
- Public handlers existed: `selectDistrict`, `openDistrict`, `openBuildingDetail`, `collectProduction`, `runBuildingAction`, `craftItem`, `openMarket`, `buyMarketItem`, `sellMarketItem`, `openAttackPanel`, `startAttack`, `openSpyPanel`, `startSpy`, `showToast`, `openPlayerProfile`, `acknowledgePendingRaid`.
- Owned district opened.
- First building detail opened.
- Building production/action path ran without JS errors.
- Storage opened and showed weapons/materials/factory resources.
- Equipment path was available through existing craft controls.
- Adjacent enemy district opened.
- Spy started and returned a report.
- Attack started with a real loadout and returned a battle report after the runtime timer.
- Battle report displayed outcome, target, attack power, losses, district state, cooldown, loot fallback, police feed fallback, police warning fallback and next action.
- Attack report no longer shows misleading `HEAT GAINED +0` when the legacy/static browser payload has no explicit heat delta; it points the player to the police feed instead.
- Police feed rendered low/medium fallback initially and extreme fallback after explicit heat pressure.
- Gang profile stars turned neon for police-threat state.
- Onboarding completed `10/10`.
- Console errors from the page: none.

## Fixes Made

- `page-assets/js/app/runtime.js`: `collectProduction()` now dispatches `empire:production-collected` after a successful public-handler click, so onboarding can track the production step without changing production math.
- `page-assets/js/app/runtime/onboardingBridge.js`: onboarding listens for `empire:production-collected`.
- `page-assets/js/app/runtime/onboardingBridge.js`: storage tracking now uses document-level click delegation for `[data-storage-popup-open]`, so the step is tracked even when the toolbar is outside the onboarding root.
- `scripts/free-session-ux-pass.mjs`: added a repeatable headless browser pass without new npm dependencies.
- `scripts/free-session-ux-pass.mjs`: upgraded the pass with validation failures for missing public handlers, broken storage/topbar refresh, missing spy/attack report, misleading attack heat `+0`, missing police feed feedback, incomplete free-loop checklist, and page console warnings/errors.
- `page-assets/js/app/runtime/resultPayloadBuilders.js`: attack result payloads keep explicit `heatAdded` values when provided, but legacy payloads without heat data now render `Police feed` and `Sleduj police feed` instead of `+0`.

## Remaining Gap

- Pending raid acknowledge still needs a real browser command transport path where server authority is present.
- Static/free browser attack reports still do not calculate their own heat delta, by design. When no authoritative `heatAdded` payload exists they now show `Police feed` instead of a fake number.

## Last Smoke Result

- Onboarding after loop: `10/10`.
- Spy report: visible.
- Attack report: visible.
- Attack report heat row: `Police feed`, not `+0`.
- Police feed risk after heat: `extreme`.
- Gang stars police threat: `true`, with `4` active neon stars.
- Final attack orders: `0`.
- Final spy missions: `0`.
- Page console warnings/errors: none.

Browser stderr contained only Chromium background service messages such as GCM registration errors; these are environment/browser noise, not page errors.

## Verification

Passed:

- `node scripts\free-session-ux-pass.mjs --url=http://127.0.0.1:5174/pages/game.html --timeout-ms=110000`
- `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\unit\runtime-result-payload-builders.test.js tests\unit\freeSessionMvpFlow.test.js`
- `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\unit\freeSessionMvpFlow.test.js tests\unit\runtime-compatibility.test.js tests\unit\runtime-wanted-panel.test.js`
- `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\unit\game-core\authoritative-gameplay-rules.test.ts`
- `npm run typecheck`
- `npm run smoke:ui`
- `npm run lint:architecture`
- `npm run lint:file-sizes`
- `npm run test:unit`

Test note: full unit initially caught an outdated police-balance expectation in `tests/unit/game-core/authoritative-gameplay-rules.test.ts`. The expectation now matches the current FREE police config: high raid seizes `12%` dirty cash, `5%` resources and reduces heat by `30`.
