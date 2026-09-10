import { promises as fs } from "node:fs";
import { FREE_HOSTED_STARTING_PLAYER_STATE } from "@empire/game-config";
import { runFullGameSimulation } from "./debug/src/full-game-20p-matrix/simulation";

const startingPlayerState = { ...FREE_HOSTED_STARTING_PLAYER_STATE, cleanCash: 6000, dirtyCash: 3000, population: 150, influence: 15 };
const report = await runFullGameSimulation({ seed: "war-audit-1", scenario: "balanced-city", startingPlayerState, skipAllianceSetup: true,
  sourceRevision: "2026-09-09-working-tree-score-police-heat-reduction", verbose: true });
await fs.writeFile(".tmp/war-balance-match-after.json", JSON.stringify({
  scope: "20-player authoritative server simulation with in-memory persistence; no browser or PostgreSQL; no free alliance setup; this is one match, not a win-rate estimate",
  startingPlayerState, report
}, null, 2));
console.log(JSON.stringify({ complete: true, durationHours: report.durationGameTimeMs / 3600000, failures: report.failureCodes, rejections: report.rejectionTotals, attacks: report.attacks, trades: report.marketTrades }));
