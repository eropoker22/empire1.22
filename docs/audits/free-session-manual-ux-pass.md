# Free Session Manual UX Pass

Date: 2026-05-06

## Verdict

Status: ready for MVP free-session click loop, with one documented legacy/core integration gap.

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
- Battle report displayed outcome, target, attack power, losses, district state, cooldown, loot fallback, heat fallback, police warning fallback and next action.
- Police feed rendered low/medium fallback initially and extreme fallback after explicit heat pressure.
- Gang profile stars turned neon for police-threat state.
- Onboarding completed `10/10`.
- Console errors from the page: none.

## Fixes Made

- `page-assets/js/app/runtime.js`: `collectProduction()` now dispatches `empire:production-collected` after a successful public-handler click, so onboarding can track the production step without changing production math.
- `page-assets/js/app/runtime/onboardingBridge.js`: onboarding listens for `empire:production-collected`.
- `page-assets/js/app/runtime/onboardingBridge.js`: storage tracking now uses document-level click delegation for `[data-storage-popup-open]`, so the step is tracked even when the toolbar is outside the onboarding root.
- `scripts/free-session-ux-pass.mjs`: added a repeatable headless browser pass without new npm dependencies.

## Remaining Gap

Legacy runtime attack reports still show `HEAT GAINED +0` unless the attack payload already contains `heatAdded` or boost heat. Core attack handlers do add police heat, but this static browser free page is still using legacy runtime fallback for that part of the loop. I did not change attack/heat gameplay calculations in this pass.

## Last Smoke Result

- Onboarding after loop: `10/10`.
- Spy report: visible.
- Attack report: visible.
- Police feed risk after heat: `extreme`.
- Gang stars police threat: `true`, with `4` active neon stars.
- Final attack orders: `0`.
- Final spy missions: `0`.
- Page console warnings/errors: none.

Browser stderr contained only Chromium background service messages such as GCM registration errors; these are environment/browser noise, not page errors.

## Verification

Passed:

- `node scripts\free-session-ux-pass.mjs --url=http://127.0.0.1:5174/pages/game.html --timeout-ms=110000`
- `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\unit\freeSessionMvpFlow.test.js tests\unit\runtime-compatibility.test.js tests\unit\runtime-wanted-panel.test.js`
- `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\unit\game-core\authoritative-gameplay-rules.test.ts`
- `npm run typecheck`
- `npm run smoke:ui`
- `npm run lint:architecture`
- `npm run lint:file-sizes`
- `npm run test:unit`

Test note: full unit initially caught an outdated police-balance expectation in `tests/unit/game-core/authoritative-gameplay-rules.test.ts`. The expectation now matches the current FREE police config: high raid seizes `12%` dirty cash, `5%` resources and reduces heat by `30`.
