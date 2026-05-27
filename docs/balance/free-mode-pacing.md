# Free BR Canonical Simulation

This document points to the current balance simulation entry point for Empire Streets Free Battle Royale. Older `free-mode-pacing` and `free-mode-shared-city-simulation` tools are kept only for historical comparison; new balance work should use `tools/debug/src/free-br-simulation`.

## Commands

```bash
npm run simulate:free-br
npm run simulate:free-br:json
npm run simulate:free-br:matrix
npm run simulate:free-br:report
npm run balance:free-mode
```

- `simulate:free-br` runs one canonical 20-player Free BR match and writes markdown, JSON, and JSONL audit outputs.
- `simulate:free-br:json` writes the JSON report for dashboards or CI consumers.
- `simulate:free-br:matrix` runs the scenario matrix across canonical, aggressive, casual, downtown, alliance, no-alliance, and high-risk crime scenarios.
- `simulate:free-br:report` regenerates the default 168-hour canonical report.
- `balance:free-mode` now aliases the canonical matrix with a shorter default run count.

## Outputs

```text
docs/balance/free-br-canonical-simulation-report.md
docs/balance/free-br-canonical-simulation-report.json
docs/balance/free-br-canonical-simulation-events.jsonl
docs/balance/free-br-canonical-simulation-matrix.md
```

The simulator uses `resolveModeConfig("free")` for Free BR pacing values and records known approximations in every markdown report. It is a tooling layer only; it must not change gameplay balance, UI, persistence, War mode, or monetization.

