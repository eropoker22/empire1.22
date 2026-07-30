# Hosted building action matrix

Date: 2026-07-30
Branch: `hardening/local-hosted-full-playability`

## Result

| Surface | Canonical actions | Covered | Missing | Duplicate |
|---|---:|---:|---:|---:|
| Public building definitions | 39 | 39 | 0 | 0 |
| Free-mode server configuration | 39 | 39 | 0 | 0 |
| Browser server-action bridge | 39 | 39 | 0 | 0 |
| Fresh hosted PostgreSQL scenarios | 39 | 39 | 0 | 0 |

- Day scenario: 35 actions.
- Night scenario: 4 actions.
- Every visible action resolves to one physical canonical-map building.
- Every browser action dispatches `run-building-action`; no local gameplay
  mutation is used.
- Every accepted command produces a persisted `building-action` report and a
  higher authoritative state version.

The machine-readable source of truth is
`tools/seed/hosted-building-action-matrix.json`.

## Gaps closed

- Added the missing Večerka bridge for
  `collect_convenience_store_population`.
- Exposed the Večerka population collection action in the shared building
  detail data.
- Changed the Magistrát emergency-decree input projection to submit canonical
  mode IDs such as `night_patrols`, rather than internal configuration keys
  such as `nightPatrols`.
- Seeded canonical action prerequisites from mode configuration, including the
  Večerka population capacity.

## Verification

| Command | Result |
|---|---|
| Targeted registry, scenario, card, and input-view unit tests | PASS |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run test:local-hosted:full -- --suite=building-actions-day` | PASS, 35/35 |
| `npm run test:local-hosted:full -- --suite=building-actions-night` | PASS, 4/4 |

The hosted runs provisioned disposable servers against the guarded local test
database, entered through the real account/lobby/game flow, used validated
gameplay sessions, and reloaded the final persisted read model. No production
deployment or production database was used.
