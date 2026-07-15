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
  "| Building | Recipe | Quantity | Ticks | Collected | Max completions/tick |",
  "| --- | --- | ---: | ---: | ---: | ---: |",
  ...report.steps.map((step) =>
    `| ${step.buildingTypeId} | ${step.recipeId} | ${step.quantity} | ${step.ticksElapsed} | ${step.collectedAmount} | ${step.maxCompletedInSingleTick} |`
  ),
  "",
  "## Reservation Audit",
  "",
  `- Factory reservation accepted: ${report.reservationAudit.factoryStartAccepted}`,
  `- Conflicting Armory command: ${report.reservationAudit.conflictingArmoryError}`,
  `- Metal Parts after Factory reservation: ${report.reservationAudit.metalPartsAfterFactoryReservation}`,
  `- Metal Parts after waiting refund: ${report.reservationAudit.metalPartsAfterWaitingRefund}`,
  `- Clean cash after waiting refund: ${report.reservationAudit.cleanCashAfterWaitingRefund}`,
  `- Duplicate cancel: ${report.reservationAudit.duplicateCancelError}`,
  "",
  "## Invariants",
  "",
  ...Object.entries(report.invariants).map(([name, passed]) => `- ${name}: ${passed ? "PASS" : "FAIL"}`),
  ""
].join("\n");
