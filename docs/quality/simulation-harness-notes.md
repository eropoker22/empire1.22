# Free-Mode Simulation Harness Notes

The free-mode shared city simulation harness is a diagnostic/dev-only tool. Its job is to prove that the current server-authoritative slice can keep a 20-player shared map alive through membership, read-model loading, command submission, ticking, reports, and feed generation.

It is not a final balancing gate. Combat pacing, spy-to-attack ratio, heat tempo, income tempo, elimination timing, victory pacing, and resource flow are still expected to move while the game systems mature.

## Hard Assertions

Hard assertions should fail only when the harness proves that the runtime structure is broken:

- the instance crashed,
- the shared map is not connected,
- player count does not match the requested scenario,
- unique home districts do not match player count,
- tick progress does not happen when ticks are requested,
- command/read-model flow throws instead of returning a handled response,
- spawn assignment creates duplicates.

These checks protect stability. They should stay conservative.

## Soft Warnings

Pacing and balance signals are warnings only:

- spy-heavy,
- low-conflict,
- high heat,
- low action acceptance,
- too many dead turns,
- no feed,
- low production,
- too few attacks,
- no eliminations.

Warnings are useful for design review, but they must not block development while core systems such as faction abilities, economy tuning, elimination pacing, and victory pacing are still in motion.

## When This Can Become A Gate

The harness can become a real balancing gate after the major gameplay mechanics are locked, expected pacing bands are documented, multi-seed variance is understood, and CI thresholds are agreed as product decisions instead of temporary development guesses.

Until then, treat the report as a smoke test plus a dashboard: hard failures mean the simulation structure is broken; warnings mean the game may need design attention later.
