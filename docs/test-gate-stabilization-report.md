# Test Gate Stabilization Report

Date: 2026-06-26

Scope: stabilize the existing Free alpha/server-authoritative test gate after the session/readModel cleanup. No gameplay features, War launch, payments, or runtime rewrite were added.

## Initial Failure Map

| Command | Initial result | First real error | Classification | Fix area | Current state |
| --- | --- | --- | --- | --- | --- |
| `npm run test:unit` | Failed | session/body drift, missing jsdom, fake DOM gaps, old overlay/readModel expectations | mixed test setup + old expectations | client tests, fake DOM, jsdom, overlay cleanup, core fixtures | Passed: 137 files, 759 tests |
| `npm run test:integration` | Failed | successful flows expected readModel while tests skipped new session/join authority | old expectation/test fixture drift | integration helpers and session setup | Passed: 19 files, 137 tests |
| `npm run test:server` | Failed | old direct load/submit expectations without valid gameplay session | old expectation + server transport contract drift | server tests and transport error mapping | Passed: 24 files, 148 tests |
| `npm run test:e2e:smoke` | Previously timed out | pending rerun in final gate | likely runtime/session startup or browser harness | E2E diagnostics still to verify | Pending final run |
| `npm test` | Previously timeout/EPIPE | broad suite did not finish cleanly before stabilization | broad gate instability | run after targeted suites are green | Pending final run |

## Main Causes

- Tests were still using old direct `playerId`/body assumptions where `load` and `submit` now require a validated gameplay session.
- Some server/integration tests expected successful read models from requests that should now fail with `SESSION_REQUIRED`, `SESSION_INVALID`, or `PLAYER_IDENTITY_MISMATCH`.
- Direct load/join fixtures mixed snapshot restore semantics with gameplay authorization.
- Core action tests expected attack/occupy without the newer spy authorization requirement.
- Client unit tests needed `jsdom` for targeted browser behavior and fake DOM helpers were missing `removeAttribute`/attribute behavior.
- Overlay tests leaked the mobile overlay ghost-click suppression window across test cases.
- Legacy player-flow smoke still selected a closed War alias; public alpha flow should use the open Free server.

## Fix Summary

- Added shared gameplay session test helpers for dev session creation, load, and spawn seeding.
- Updated server/integration tests to use join/session flows before successful load/submit assertions.
- Preserved production fail-closed behavior for missing production session/runtime readiness.
- Updated transport session errors so missing, invalid, and mismatched sessions map to distinct safe error codes.
- Kept snapshot tokens limited to state restore; they do not authorize load/submit.
- Updated duplicate command expectations to match idempotent replay for same-payload applied commands.
- Seeded spy authorization in core tests that exercise attack/occupy after reconnaissance.
- Installed targeted `jsdom` dependency and expanded small fake DOM helpers.
- Added test-only overlay reset to prevent unit test state leakage.
- Updated legacy public flow smoke to select the open Free server while keeping War closed.

## Verified Results So Far

- `node scripts/run-local-bin.mjs vitest/vitest.mjs run tests/server/command-dispatch-safety.test.ts tests/server/instance-manager.test.ts tests/server/gameplay-slice-identity-transport.test.ts`: passed.
- `node scripts/run-local-bin.mjs vitest/vitest.mjs run tests/server/gameplay-slice-netlify-function.test.ts`: passed, 22 tests.
- `npm run test:server`: passed, 24 files, 148 tests.
- `npm run test:integration`: passed, 19 files, 137 tests.
- `node scripts/run-local-bin.mjs vitest/vitest.mjs run tests/unit/game-core/free-mode-cooldowns.test.ts tests/unit/game-core/elimination-system.test.ts tests/unit/game-core/authoritative-gameplay-rules.test.ts`: passed, 3 files, 34 tests.
- `node scripts/run-local-bin.mjs vitest/vitest.mjs run tests/unit/client/gameplay-slice-page-events.test.ts tests/unit/client/client-surface-actions.test.ts tests/unit/client/overlay-backdrop.test.ts`: passed, 3 files, 33 tests.
- `npm run test:unit`: passed, 137 files, 759 tests.

## Pending Final Gate

Run after documentation and code stabilization:

- `npm run lint`
- `npm run typecheck`
- `npm run test:integration`
- `npm run test:server`
- `npm run build:admin:page`
- `npm run test:e2e:smoke`
- `npm test`

If `npm test` times out because of total suite length, record the timeout and rely on the green targeted scripts above plus the final E2E result.
