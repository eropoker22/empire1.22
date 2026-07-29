# Local hosted hardening baseline

Date: 2026-07-29  
Branch: `hardening/local-hosted-full-playability`  
Starting HEAD: `13b9985428511885cae088428554ca7020912458`  
Expected parity HEAD: matched  
Node.js: `v24.18.0`  
npm: `11.16.0`

## Repository state

- The sprint starts from the completed UI parity commit series ending in
  `13b9985 fix: simplify lobby online player count`.
- No tracked file was modified before the baseline.
- The only untracked path was `.tmp/`; it contains the portable Node.js 24
  toolchain, local hosted logs, and UI parity diagnostics. It remains excluded
  from commits.
- No reset, clean, migration edit, production deployment, or production
  database access was performed.

## Baseline commands

| Command | Started | Finished | Exit | Result | Classification |
|---|---:|---:|---:|---|---|
| `npm ci` | 22:10:46 | 22:12:16 | 0 | PASS | Clean Node 24 install completed. npm reported 8 dependency advisories for later triage. |
| `npm run check:node` | 22:12:39 | 22:12:41 | 0 | PASS | Node 24 policy accepted. |
| `npm run generate:browser-config` | 22:12:41 | 22:14:06 | 0 | PASS | Generated output remained clean. |
| `npm run check:browser-config` | 22:14:06 | 22:14:13 | 0 | PASS | Generated browser config is current. |
| `npm run check:production-fixture-boundary` | 22:14:13 | 22:14:20 | 0 | PASS | Production fixture boundary passed. |
| `npm run lint` | 22:14:20 | 22:14:58 | 1 | FAIL | P1: `gameplay-slice-page.ts` exceeds its explicit debt budget by 22 lines. |
| `npm run typecheck` | 22:14:58 | 22:15:57 | 0 | PASS | TypeScript contract is valid. |
| `npm test` | 22:16:08 | 22:23:26 | 1 | FAIL | Unit stage: 3 failed, 1761 passed. Later stages did not run because the command is fail-fast. |
| `npm run test:e2e:smoke` | 22:23:45 | 22:31:45 | 0 | PASS | Chromium: 24 passed, including login, lobby, faction, game, onboarding, and local-demo production. |

All times use Europe/Bratislava local time.

## Confirmed baseline failures

### P1: client file-size debt

- File: `apps/client/src/browser/gameplay-slice-page.ts`
- Actual: 488 lines
- Explicit budget: 466 lines
- Effect: architecture/lint gate is red.
- Required fix: extract a focused controller responsibility; do not raise the
  debt budget.

### P1: stale building-action source-shape guards

- File: `tests/unit/building-special-action-runtime-server-branch.test.js`
- Failures: 2
- The assertions search source text for an older inline cooldown/news sequence
  and an older `"Handler", value: "Server"` diagnostic row.
- The current runtime delegates accepted-response handling and shared
  presentation through extracted modules.
- Required fix: verify the actual authority behavior, then replace brittle
  source-text assertions with behavioral contract assertions. Do not weaken
  the server-authority requirement.

### P1: stale admin SHA renderer assertion

- File: `tests/unit/production-authority-cutover-guards.test.js`
- Failure: 1
- The test expects `keyValue("Frontend SHA"` in
  `admin-control-plane-view.ts`, while the current design renders SHA values
  through the escaped `codeValue` presentation helper.
- Required fix: preserve build diagnostics and update the test to assert the
  current safe renderer contract.

## Tests not reached by `npm test`

Because `npm test` stops after a failing unit stage, these baseline stages are
`NOT RUN`, not `PASS`:

- `npm run test:integration`
- `npm run test:server`
- `npm run test:persistence`
- `npm run test:read-models`

They must be executed independently after the baseline regressions are fixed.

## Baseline interpretation

- The generic browser smoke proves that the existing local/demo entry flow is
  not broadly broken.
- It does **not** prove fresh PostgreSQL-backed hosted gameplay, authoritative
  production, authoritative income, multi-client synchronization, or server
  cancellation.
- The existing parity code and test files are implementation evidence only;
  they are not treated as a hosted PASS until exercised against a freshly
  provisioned local server.
- Remote staging and public deployment remain intentionally deferred.
