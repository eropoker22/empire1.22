# Runtime And Publish Output Audit

Audit date: 2026-05-04

Scope: map canonical source versus generated publish output and identify safe, small runtime extraction steps. No `client/` files were edited manually.

## Canonical Source

Canonical browser source is rooted at:

- `pages/`
- `page-assets/`
- `img/`

`scripts/build-netlify-client.mjs` defines `client/` as publish output:

- `publishDir = client`
- static source dirs include `pages`, `page-assets`, `img`, plus explicit legacy browser compatibility modules
- the script deletes `client/` and copies source directories into it

Therefore `client/` should be regenerated, not edited by hand.

## Source Versus Publish Output

`page-assets/` currently differs from `client/page-assets/` in 7 files:

| File | Root size | Client size | Note |
|---|---:|---:|---|
| `css/styles-building-modals.css` | 138124 | 134856 | stale generated output |
| `css/styles-game-redesign.css` | 113175 | 101678 | stale generated output |
| `css/styles-mobile-fixes.css` | 57183 | 47308 | stale generated output |
| `css/styles-popups.css` | 66083 | 64616 | stale generated output |
| `js/admin-assets/admin-slice-demo.js` | 284472 | 284827 | stale generated output |
| `js/app/runtime.js` | 780535 | 680868 | stale generated output |
| `js/faction.js` | 42327 | 41072 | stale generated output |

Additional publish drift was observed outside `page-assets/`:

- `pages/faction.html` differs.
- `pages/game.html` differs.
- `img/lista2.jpeg` is missing from `client/img`.
- `img/tapeta.png` is missing from `client/img`.

Safe correction:

1. Keep editing only canonical root files.
2. Regenerate publish output with the existing build script, for example `npm run build:admin:page` or the lower-level `node scripts/build-netlify-client.mjs`.
3. Add or keep CI checks that fail on stale generated output if `client/` remains tracked.
4. Do not manually merge individual `client/` files back into root source.

## Runtime Mapping

Root runtime:

- `page-assets/js/app/runtime.js`
- current length: 19145 lines

Generated runtime:

- `client/page-assets/js/app/runtime.js`
- current length: 17391 lines
- this is stale publish output and should be regenerated from root source

Main sections in root `runtime.js`:

| Approx. lines | Section |
|---:|---|
| 1-500 | imports, constants, selectors, global runtime state |
| 500-1900 | district action definitions, modal/result plumbing, session helpers |
| 1900-2900 | local police/heat/wanted preview state |
| 3200-3700 | police action result modal/rendering |
| 4100-4520 | attack, occupy, robbery preview order logic |
| 4520-4700 | spy state and mission setup |
| 4700-6280 | production preview state for pharmacy, factory, drug lab, armory |
| 6280-7000 | market popup, player market, black-market heat preview |
| 7100-7600 | page context, bootstrap, map seed helpers |
| 7600-11880 | district building catalog, building detail profiles, actions, mechanics |
| 11900-12350 | spy/rumor/detail support helpers |
| 12350-13750 | map geometry, canvas drawing, animations |
| 13750-17250 | UI binders, popups, action dispatch, synchronization helpers |
| 17250-19000 | bootstrap, event binding, exported globals |

## Safe Extraction Candidates

Do not perform a large runtime refactor in one PR. These are low-risk extraction candidates, ordered from safest to riskiest:

1. Constants/selectors module
   - Move data-only selectors and label constants.
   - No behavior changes.
   - Verify with `smoke:ui`.
2. Building profile data module
   - Move static building profile/action data used by detail panels.
   - Keep rendering functions in runtime for the first PR.
3. Production preview formatting helpers
   - Extract pure helpers for labels, durations, resource display, and storage payload shaping.
   - Keep mutation and DOM binding in runtime.
4. Market preview state helpers
   - Use existing `page-market-state` tests as a guard.
   - Avoid moving black-market heat behavior in the first extraction.
5. Police preview UI module
   - Move only modal/render helpers first.
   - Do not move authoritative police rules into browser code.
6. Map geometry/drawing module
   - Requires smoke/browser verification because canvas regressions are easy to miss.

## Small-PR Runtime Plan

1. PR 1: extract constants/selectors and prove no bundle/runtime behavior change with smoke tests.
2. PR 2: extract static building profile data and add a projection/render smoke test for representative buildings.
3. PR 3: extract production display helpers; keep production state mutation in place.
4. PR 4: extract market display helpers around existing tests.
5. PR 5: extract police modal render helpers after server police projection shape is decided.

Stop after each PR and regenerate `client/` only through the build script.
