# File Size Debt Report

Generated from `npm run lint:file-sizes` on 2026-05-15.

This report is documentation only. No file-size debt was fixed in this pass.

## Current Check

The file-size gate is implemented in `scripts/check-file-sizes.mjs`.

- Default source file limit: 250 lines.
- Some existing large modules have explicit debt budgets.
- `page-assets/js/app/runtime.js` has a separate legacy budget and was not part
  of the current failing set.

Current result:

- `npm run lint:file-sizes`: failed with 19 file-size violations.
- The npm warnings about log file creation were cache/log permission warnings,
  not file-size check failures.

## Debt Inventory

| File | Lines | Limit | Over | Module / Category | Refactor Risk | Recommended First Split |
| --- | ---: | ---: | ---: | --- | --- | --- |
| `apps/client/src/selectors/district-panel-view-model.ts` | 251 | 250 | 1 | Client selector / view model | Low | Move one small formatting/helper block into a sibling selector helper. |
| `packages/game-core/src/contracts/civic-building-balance-config.ts` | 327 | 250 | 77 | Core contract / balance typing | Medium | Split civic building balance subcontracts by building group or passive/action section. |
| `packages/game-core/src/handlers/centralBankPassive.ts` | 259 | 250 | 9 | Core handler / passive building | Low | Extract finance calculation helpers or constants into `centralBankPassiveMath.ts`. |
| `packages/game-core/src/handlers/cityHallBuildingActions.ts` | 258 | 250 | 8 | Core handler / building action | Low | Extract request/preview helper functions while keeping command behavior unchanged. |
| `packages/game-core/src/handlers/convenienceStoreBuildingActions.ts` | 424 | 333 | 91 | Core handler / explicit debt | Medium | Split action definitions from execution helpers and validation helpers. |
| `packages/game-core/src/handlers/lobbyClubBuildingActions.ts` | 457 | 250 | 207 | Core handler / building action | Medium | Extract action catalog, effect calculators, and result builders into small modules. |
| `packages/game-core/src/handlers/restaurantBuildingActions.ts` | 363 | 285 | 78 | Core handler / explicit debt | Medium | Split income/action definitions from shared food-service calculation helpers. |
| `packages/game-core/src/handlers/stockExchangePassive.ts` | 259 | 250 | 9 | Core handler / passive building | Low | Extract market multiplier math or constants into a passive helper module. |
| `packages/game-core/src/handlers/stripClubBuildingActions.ts` | 562 | 459 | 103 | Core handler / explicit debt | Medium-High | Split action catalog, influence/heat math, and result text/effects separately. |
| `packages/game-core/src/handlers/vipLoungeBuildingActions.ts` | 356 | 250 | 106 | Core handler / building action | Medium | Extract VIP action definitions and shared influence/market effect helpers. |
| `packages/game-core/src/legacy-page/combat-preview-rules.js` | 400 | 250 | 150 | Legacy page / combat preview | High | First isolate pure preview math from DOM/legacy compatibility assumptions. |
| `packages/game-core/src/projections/district-building-finance-stats.ts` | 266 | 250 | 16 | Core projection / finance read model | Low-Medium | Extract finance row aggregation helpers without changing output shape. |
| `packages/game-core/src/projections/police-read-model-projection.ts` | 281 | 250 | 31 | Core projection / police read model | Medium | Split quiet/summary/status builders while snapshotting current projection output. |
| `packages/game-core/src/rules/economy/fixedBuildingIncomeConfig.ts` | 271 | 250 | 21 | Core economy config | Low | Split fixed income table by building class or export grouped constants. |
| `packages/game-core/src/rules/events/rumorPipeline.ts` | 365 | 250 | 115 | Core rules / city feed rumors | Medium | Extract generation stages: source selection, truthiness, rendering, and filtering. |
| `packages/game-core/src/rules/heists/heistSystem.ts` | 1944 | 1679 | 265 | Core rules / heists explicit debt | High | First split types/config/constants and pure risk/loot calculators; leave orchestration last. |
| `packages/game-core/src/validation/validateRunBuildingActionSpecifics.ts` | 263 | 250 | 13 | Core validation | Medium | Extract per-building specific validators behind the same validation API. |
| `tools/debug/src/free-mode-pacing/actions.ts` | 377 | 250 | 127 | Debug tooling / simulation actions | Low | Split bot action selection from command construction and faction behavior helpers. |
| `tools/debug/src/free-mode-pacing/report.ts` | 252 | 250 | 2 | Debug tooling / simulation report | Low | Move one formatting helper or table builder into `report-formatting.ts`. |

## Priority Groups

### Safe Extractions

These are either tool-only files, tiny overages, pure config tables, or read
model helpers where a small mechanical split can be verified with focused tests.

1. `tools/debug/src/free-mode-pacing/report.ts`
2. `apps/client/src/selectors/district-panel-view-model.ts`
3. `packages/game-core/src/handlers/centralBankPassive.ts`
4. `packages/game-core/src/handlers/stockExchangePassive.ts`
5. `packages/game-core/src/handlers/cityHallBuildingActions.ts`
6. `packages/game-core/src/rules/economy/fixedBuildingIncomeConfig.ts`
7. `tools/debug/src/free-mode-pacing/actions.ts`
8. `packages/game-core/src/projections/district-building-finance-stats.ts`

Recommended approach:

- Extract pure helpers only.
- Keep public exports and output shape unchanged.
- Run the most local unit/integration tests plus `npm run typecheck`.

### Medium-Risk Extractions

These are gameplay-facing core handlers, contracts, projections, or validation
modules. They should be split with characterization tests first.

1. `packages/game-core/src/contracts/civic-building-balance-config.ts`
2. `packages/game-core/src/handlers/convenienceStoreBuildingActions.ts`
3. `packages/game-core/src/handlers/lobbyClubBuildingActions.ts`
4. `packages/game-core/src/handlers/restaurantBuildingActions.ts`
5. `packages/game-core/src/handlers/vipLoungeBuildingActions.ts`
6. `packages/game-core/src/projections/police-read-model-projection.ts`
7. `packages/game-core/src/rules/events/rumorPipeline.ts`
8. `packages/game-core/src/validation/validateRunBuildingActionSpecifics.ts`

Recommended approach:

- Add or identify snapshot/behavior tests before splitting.
- Extract catalogs/config first, then calculators, then orchestration helpers.
- Avoid changing balancing values or returned DTO/read model shapes.

### Risky Legacy/UI or High-Blast Extractions

These files either contain legacy compatibility logic or large gameplay
orchestration. They should not be first unless there is a dedicated test budget.

1. `packages/game-core/src/legacy-page/combat-preview-rules.js`
2. `packages/game-core/src/rules/heists/heistSystem.ts`
3. `packages/game-core/src/handlers/stripClubBuildingActions.ts`

Recommended approach:

- Start with characterization tests around current behavior.
- Extract pure types/constants first.
- Avoid moving orchestration and side-effect coordination until helpers are
  already stable.
- For legacy JS, preserve existing public names and import shape.

## Suggested Small-PR Order

### PR 1: Tiny Overages and Tooling

Targets:

- `tools/debug/src/free-mode-pacing/report.ts`
- `apps/client/src/selectors/district-panel-view-model.ts`
- `packages/game-core/src/handlers/centralBankPassive.ts`
- `packages/game-core/src/handlers/stockExchangePassive.ts`
- `packages/game-core/src/handlers/cityHallBuildingActions.ts`

Why first:

- Smallest line overages.
- Low behavioral risk.
- Good way to re-green the gate incrementally.

### PR 2: Static Config and Finance Projections

Targets:

- `packages/game-core/src/rules/economy/fixedBuildingIncomeConfig.ts`
- `packages/game-core/src/projections/district-building-finance-stats.ts`
- `packages/game-core/src/contracts/civic-building-balance-config.ts`

Why second:

- Mostly structural extraction.
- High value for keeping future balance/config changes smaller.

### PR 3: Simulation Actions

Target:

- `tools/debug/src/free-mode-pacing/actions.ts`

Why third:

- Tooling-only behavior.
- Can be validated with simulation tests and `npm run simulate:free-mode`.

### PR 4: Building Action Handlers

Targets:

- `packages/game-core/src/handlers/convenienceStoreBuildingActions.ts`
- `packages/game-core/src/handlers/restaurantBuildingActions.ts`
- `packages/game-core/src/handlers/vipLoungeBuildingActions.ts`
- `packages/game-core/src/handlers/lobbyClubBuildingActions.ts`

Why fourth:

- Gameplay-facing but naturally split by action catalog, validators, and effect
  calculators.

### PR 5: Read Model and Event Pipeline

Targets:

- `packages/game-core/src/projections/police-read-model-projection.ts`
- `packages/game-core/src/rules/events/rumorPipeline.ts`
- `packages/game-core/src/validation/validateRunBuildingActionSpecifics.ts`

Why fifth:

- More behavior-sensitive.
- Needs stronger characterization tests.

### PR 6: Large/Risky Modules

Targets:

- `packages/game-core/src/rules/heists/heistSystem.ts`
- `packages/game-core/src/handlers/stripClubBuildingActions.ts`
- `packages/game-core/src/legacy-page/combat-preview-rules.js`

Why last:

- Highest blast radius.
- Best done after the smaller extraction pattern is proven.

## Top 3 First Refactor Candidates

1. `tools/debug/src/free-mode-pacing/report.ts`
   - Only 2 lines over the limit.
   - Debug tooling, not gameplay authority.
   - First split: move table/format helper to `report-formatting.ts`.

2. `apps/client/src/selectors/district-panel-view-model.ts`
   - Only 1 line over the limit.
   - First split: move a pure formatting helper to a sibling selector helper.
   - Needs only selector/unit smoke coverage.

3. `packages/game-core/src/handlers/centralBankPassive.ts`
   - Only 9 lines over the limit.
   - First split: move finance math/constants to a small helper.
   - More important than tool-only debt, but still narrow.

## Next Work

- Pick one safe extraction PR.
- Add or run focused tests before and after each split.
- Do not combine behavior changes with file-size extractions.
- Keep explicit debt budgets updated only when shrinking files, not when making
  debt larger.
- Re-run `npm run lint:file-sizes` after each PR.
