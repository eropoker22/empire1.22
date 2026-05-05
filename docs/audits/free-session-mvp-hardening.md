# Free Session MVP Hardening

Date: 2026-05-05

## Status

Status: partial.

The free loop is mapped, UI fallback paths are in place, public handlers are registered, onboarding and police feedback exist, and automated gates pass. It is not marked `ready` yet because a real browser end-to-end click pass still needs to confirm timers, popup ordering and canvas interaction.

Gameplay calculations were not changed. The only behavior-adjacent fixes are UI/recovery guards: start-district ownership recovery from an existing registration value, UI event dispatch for progress panels, battle report fallback labels, and safe public handler aliases.

## Free Loop Audit

| Step | Status | Main files | Missing / blocker | Smallest safe fix |
| --- | --- | --- | --- | --- |
| 1. Boot hry | ready | `pages/game.html`, `page-assets/js/app/runtime.js` | No known blocker. Browser click pass pending. | Keep bootstrap idempotent and covered by `smoke:ui`. |
| 2. Vstup do free modu | ready | `page-assets/js/app/auth-flow.js`, `page-assets/js/app/model/authority-state.js` | No known blocker. | `saveLobbyStep` keeps `serverMode: free`; default phase stays `live`. |
| 3. Vytvoreni/nacteni hrace | ready | `auth-flow.js`, `authority-state.js`, `runtime.js` | Corrupted storage can still drop optional fields. Not blocking. | Existing normalization plus no-crash UI fallbacks. |
| 4. Start district | ready | `auth-flow.js`, `runtime.js` | Registration with `startDistrictId` but missing `ownedDistrictIds` was a blocker risk. | Added recovery that restores owned district from existing start district only. |
| 5. Mapa | partial | `runtime.js`, `map/*` | Canvas interaction must still be manually checked. | No map rewrite; keep existing renderer and add no new geometry changes. |
| 6. Vlastni district | ready | `runtime.js`, `map/districtViewModel.js` | Missing selection can block old onclick flows. | Public `selectDistrict/openDistrict` delegate to district runtime API. |
| 7. Building detail | ready | `runtime.js`, `ui/buildingDetailPanel.js` | Missing selected district could block direct handler calls. | Public `openBuildingDetail` falls back to first owned district when possible. |
| 8. Collect production | ready | `runtime.js`, `ui/productionPanel.js`, `production-collect-results.js` | Hidden/missing collect buttons must not crash. | Public `collectProduction` clicks first enabled collect path and returns `false` safely otherwise. |
| 9. Resources/storage refresh | ready | `runtime.js`, `ui/resourcesPanel.js` | Refresh could be invisible to onboarding. | Action result and runtime refresh events now update onboarding/police bridges. |
| 10. Craft/basic equipment | partial | `runtime.js`, `ui/recipePanel.js`, `ui/productionPanel.js` | Recipe targeting by id is not exposed in DOM. Not blocking because first enabled craft path exists. | Public `craftItem` safely clicks first enabled craft start button. No recipe costs changed. |
| 11. Cizi district | ready | `runtime.js`, `map/districtViewModel.js` | Missing selected district could break direct calls. | Public district API can open enemy district by id. |
| 12. Spy | ready | `runtime.js`, `ui/attackPanel.js`, `resultPayloadBuilders.js` | Missing enemy/spy availability returns false instead of crashing. | Public `openSpyPanel/startSpy` delegate to existing validation and action code. |
| 13. Attack | ready | `runtime.js`, `ui/attackPanel.js` | Missing loadout/invalid context returns false. | Public `openAttackPanel/startAttack` delegate to existing validation and action code. |
| 14. Battle report | ready | `ui/battleReportPanel.js`, `runtime/resultPayloadBuilders.js`, `runtime/resultModalRuntime.js` | Partial payloads lacked clear fallback labels. | Added fallback rows for loot, heat, police warning, cooldown and next action. |
| 15. Heat/wanted | ready | `runtime.js`, `ui/wantedPanel.js`, `runtime/policeHeatBridge.js` | Heat changes could be invisible outside wanted popup. | Added `empire:heat-changed` UI event and read-only police feedback bridge. |
| 16. Police feedback | ready | `ui/policeFeedPanel.js`, `runtime/policeHeatBridge.js` | No full police system change requested. | Added low/medium/high/extreme feedback from current heat/wanted state or real police events. |
| 17. Map/UI refresh | partial | `runtime.js`, `map/*`, `runtime/onboardingBridge.js` | Real canvas/timer refresh still needs browser pass. | Runtime refresh now updates onboarding and police panels without mutating gameplay. |
| 18. Dalsi doporucena akce | ready | `ui/onboardingPanel.js`, `runtime/onboardingBridge.js`, `ui/battleReportPanel.js` | Previously no first-session task list. | Added onboarding hints and battle report next-action fallback. |

## Fixed Blockers

- `page-assets/js/app/runtime/compatibility.js`
  - Problem: legacy/window handlers only covered runtime and toast aliases.
  - Fix: registered free-loop aliases such as `selectDistrict`, `openDistrict`, `openBuildingDetail`, `collectProduction`, `craftItem`, `openAttackPanel`, `startAttack`, `openSpyPanel`, `startSpy`, market handlers and `openPlayerProfile`.
- `page-assets/js/app/runtime.js`
  - Problem: UI progress panels had no stable action/result events and old direct handlers had no safe delegation.
  - Fix: added UI-only events for district/building/action/spy/attack/result/heat, safe public wrappers and start-district recovery from existing registration state.
- `page-assets/js/app/ui/battleReportPanel.js`
  - Problem: partial attack payloads did not clearly show loot, heat, police warning or next action.
  - Fix: render fallback extra rows without requiring gameplay payload changes.
- `page-assets/js/app/runtime/resultPayloadBuilders.js`
  - Problem: missing attack timestamps could render unsafe duration labels.
  - Fix: clamp missing/invalid report duration to `0` for UI display.

## Onboarding

Files:

- `page-assets/js/app/ui/onboardingPanel.js`
- `page-assets/js/app/runtime/onboardingBridge.js`

Steps:

1. Otevri svuj district.
2. Otevri prvni budovu.
3. Seber prvni produkci.
4. Zkontroluj sklad.
5. Vyrob nebo priprav zakladni vybaveni.
6. Vyber cizi district.
7. Proved spehovani.
8. Spust prvni utok.
9. Precti battle report.
10. Sleduj heat a police warning.

Progress is read-only. It observes existing runtime state and UI events, persists only completed/minimized/hidden panel state, and never changes resources, cooldowns, recipes, attacks, spy, ownership or heat.

## Police MVP

Files:

- `page-assets/js/app/ui/policeFeedPanel.js`
- `page-assets/js/app/runtime/policeHeatBridge.js`
- existing `page-assets/js/app/ui/wantedPanel.js`

Feedback levels:

- Low: small status, gang is under low monitoring.
- Medium: warning that police are watching.
- High: stronger warning about control/raid risk.
- Extreme: strong warning that another loud action can trigger intervention.

If a real police action exists, the feed displays it. If not, it displays fallback copy derived from current heat/wanted state. Heat math, raid chance and police effects are unchanged.

## Battle Report

Battle reports now show or safely fall back for:

- success/failure title and badge,
- captured/not captured district state,
- attacker losses,
- defender losses,
- loot,
- heat gained,
- police warning,
- cooldown/duration,
- next action back to map/next target.

## Tests

Passed:

- `node scripts\run-local-bin.mjs vitest\vitest.mjs run tests\unit\freeSessionMvpFlow.test.js tests\unit\runtime-compatibility.test.js tests\unit\runtime-result-payload-builders.test.js tests\unit\runtime-battle-report-panel.test.js tests\unit\runtime-wanted-panel.test.js tests\unit\runtime-free-session-checklist.test.js`
- `npm run typecheck`
- `npm run smoke:ui`
- `npm run lint:architecture`
- `npm run lint:file-sizes`
- `npm run test:unit` - 92 files / 339 tests passed

Not run:

- Full manual browser click-through. This remains the main readiness gap.

## Manual Checklist

1. Open game page.
2. Enter free mode.
3. Verify onboarding panel.
4. Click owned district.
5. Open building.
6. Collect production.
7. Check resources/storage.
8. Craft or prepare equipment.
9. Click enemy district.
10. Start spy.
11. Start attack.
12. Read battle report.
13. Verify heat/wanted.
14. Verify police feed.
15. Verify map refresh.
16. Verify demo mode is not active unless explicitly selected.
