# Free Mode Pacing Report

This report is a dev-only design tool for the first 30-60 minutes of free mode. It runs deterministic shared-city simulations and surfaces pacing signals without changing production runtime state or balance values.

## Commands

```bash
npm run simulate:free-mode-pacing-report
npm run simulate:free-mode-pacing-report:json
npm run simulate:free-mode-pacing-report:matrix
npm run balance:free-mode
```

- `simulate:free-mode-pacing-report` prints a readable report for `shared-city-20p`.
- `simulate:free-mode-pacing-report:json` prints the same report as JSON for CI or dashboards.
- `simulate:free-mode-pacing-report:matrix` prints the design matrix for the five long-form scenarios: solo 30m, shared-city 5p, shared-city 20p, aggressive conflict, passive economy.
- `balance:free-mode` runs a shorter baseline gate intended for CI. It fails only on hard deadlocks; pacing extremes are printed as soft warnings.

To override scenarios:

```bash
npm run balance:free-mode -- --scenarios=baseline-20p-short,small-8p
npm run simulate:free-mode-shared-city -- --matrix --json --scenarios=baseline-20p-short
```

## Milestones

- `firstMeaningfulActionMinute`: first accepted command of any type. If this misses the target, the core loop is blocked.
- `firstProductionCollectionMinute`: first accepted `collect-production`. This checks whether production can be harvested early.
- `firstCraftStartedMinute`: first accepted `craft-item`. This checks whether starter economy reaches crafting.
- `firstAttackReadinessMinute`: first round where at least one player has an available attack path.
- `firstAcceptedAttackMinute`: first accepted attack command.
- `firstExpansionMinute`: first increase in owned districts.

## Warnings

Warnings are design signals, not automatic balance changes.

- `slow-first-action`, `first-action-deadlock`: player cannot act soon enough.
- `no-production-collection`, `slow-production-collection`: production is blocked or delayed.
- `no-crafting`, `slow-craft`: crafting is blocked or delayed.
- `slow-attack-readiness`, `attack-ready-too-early`: conflict opens outside the target window.
- `dead-turn-pressure`, `high-dead-turn-rate`: bots often have no valid action.
- `high-heat-pressure`, `early-heat-spike`: heat/raid pressure rises too fast.
- `resource-bottlenecks`: one or more resources end near zero or net-negative.

## Bottleneck Resources

`bottleneckResources` lists resources with very low final average per player or net drain during the window. Treat these as dependency checks:

- Low `metal-parts` or `chemicals` can block crafting and production upgrades.
- Low `tech-core` can be acceptable if it is intentionally rare, but it should not block the first meaningful action.
- Low crafted items such as `stim-pack` are useful signals only after recipes are expected to be reachable.

## MVP Pacing Targets

The gate thresholds live in `tools/debug/src/free-mode-shared-city-simulation/balance-thresholds.ts`.

- First meaningful action: at or before 5 minutes.
- First production collection: at or before 10 minutes.
- First craft: at or before 30 minutes.
- Attack readiness: between 2 and 30 minutes.
- Early heat: max heat should stay at or below 80 before minute 10.
- Action acceptance rate: at least 60%.
- Dead-turn rate: at most 75%.

The CI gate fails only on hard deadlocks such as no accepted actions, no first meaningful action by the hard limit, disconnected map, crashed instances, or home district assignment collisions. Other threshold misses remain soft warnings so design can review them without blocking unrelated engineering work.

## Recommended Tuning

Current long-form `shared-city-20p` output shows attack readiness and accepted attacks at minute 1, plus heat crossing the early pressure threshold quickly. That suggests conflict is opening too early and heat may snowball before economy players have enough meaningful non-conflict actions.

Recommended next tuning pass, without changing values in this task:

- Delay attack readiness slightly by increasing early attack cost/cooldown or requiring a clearer spy/intel step.
- Add or improve low-heat economy actions for scout/balanced/economy profiles to reduce dead-turn pressure.
- Review early heat gain on repeated attacks before adjusting raid thresholds.
