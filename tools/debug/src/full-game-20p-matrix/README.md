# Empire Streets Full Game Matrix

Canonical 20-player simulation exercises the hosted, server-authoritative path:

`gameplay session -> gameplaySliceTransport -> command ingress -> atomic dispatcher -> game-core -> transactional persistence -> projection -> durable worker tick -> snapshot recovery`

It does not mutate player resources, district ownership, eliminations, or the winner after gameplay starts. Time is advanced through the normal tick lifecycle with the production ratios from the selected game mode.

## Commands

Run one deterministic game:

```powershell
npm run simulate:full-game -- --seed=1 --scenario=balanced-city
```

Replay a failed seed with progress output:

```powershell
npm run simulate:full-game -- --seed=12345 --scenario=high-conflict --verbose
```

Run the canonical ten-game matrix:

```powershell
npm run simulate:full-game:matrix
```

The six supported scenario profiles are `balanced-city`, `high-conflict`, `economy-heavy`, `police-chaos`, `alliance-war`, and `endgame-pressure`.

Merge independently generated raw runs and recompute every verdict:

```powershell
npm run simulate:full-game:matrix:merge -- --runs=artifacts/simulation/full-game-runs --out=artifacts/simulation/full-game-merged --seeds=1..10 --scenarios=balanced-city,high-conflict,economy-heavy,police-chaos,alliance-war,endgame-pressure
```

The loader never trusts stored `passed`, `status`, or `verdict` fields. Game and matrix verdicts are derived again from raw lifecycle, winner, persistence, recovery, idempotence, concurrency, immutability, invariant, exception, rejection, and required-coverage metrics. Expected rejections require an exact audited error code and an explicit gameplay or concurrency expectation; unknown codes fail closed.

## Artifacts

The default output is `artifacts/simulation/full-game/`. Each game writes a machine-readable summary. Failed games also write their last command trace. The matrix writes aggregate JSON coverage, faction and archetype diagnostics, failure classifications, and `FULL_GAME_MATRIX_REPORT.md`.

Generated artifacts and the bundled simulation executable are intentionally not committed.
