import type { ProductionChainSimulationReport } from "./simulation";

export const formatProductionChainSimulationMarkdown = (report: ProductionChainSimulationReport): string => [
  "# Production Chain Simulation",
  "",
  `- Result: ${report.passed ? "PASS" : "FAIL"}`,
  `- Scenario: ${report.deterministicScenario}`,
  `- Final pistol inventory: ${report.finalBalances.pistol ?? 0}`,
  `- Final clean cash: ${report.finalBalances.cash ?? 0}`,
  "",
  "## Authoritative Steps",
  "",
  "| Building | Recipe | Quantity | Resolution ticks | Produced |",
  "| --- | --- | ---: | ---: | ---: |",
  ...report.steps.map((step) =>
    `| ${step.buildingTypeId} | ${step.recipeId} | ${step.quantity} | ${step.ticksElapsed} | ${step.producedAmount} |`
  ),
  "",
  "## Instant Atomicity Audit",
  "",
  `- Factory craft accepted: ${report.atomicityAudit.factoryCraftAccepted}`,
  `- Conflicting Armory command: ${report.atomicityAudit.conflictingArmoryError}`,
  `- Metal Parts after Factory craft: ${report.atomicityAudit.metalPartsAfterFactoryCraft}`,
  `- Clean cash after Factory craft: ${report.atomicityAudit.cleanCashAfterFactoryCraft}`,
  `- Rejected Armory preserved balances: ${report.atomicityAudit.rejectedArmoryPreservedBalances}`,
  `- Legacy production jobs remaining: ${report.atomicityAudit.legacyProductionJobsRemaining}`,
  "",
  "## Invariants",
  "",
  ...Object.entries(report.invariants).map(([name, passed]) => `- ${name}: ${passed ? "PASS" : "FAIL"}`),
  ""
].join("\n");
