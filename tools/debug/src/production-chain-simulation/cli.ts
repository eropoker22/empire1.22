import { promises as fs } from "node:fs";
import { dirname } from "node:path";
import {
  formatProductionChainSimulationMarkdown,
  runProductionChainSimulation
} from "./index";

declare const process: {
  argv: string[];
  exitCode?: number;
};

const JSON_OUT = "docs/balance/production-chain-simulation-report.json";
const MARKDOWN_OUT = "docs/balance/production-chain-simulation-report.md";
const report = runProductionChainSimulation();
const writeFiles = !process.argv.includes("--no-write");

if (writeFiles) {
  await Promise.all([
    writeFile(JSON_OUT, `${JSON.stringify(report, null, 2)}\n`),
    writeFile(MARKDOWN_OUT, formatProductionChainSimulationMarkdown(report))
  ]);
}

console.log(`Production chain simulation: ${report.passed ? "PASS" : "FAIL"}`);
console.log(`Steps: ${report.steps.map((step) => `${step.buildingTypeId}/${step.recipeId}=${step.collectedAmount}`).join(", ")}`);
console.log(`Reservation conflict: ${report.reservationAudit.conflictingArmoryError}`);
console.log(`Duplicate cancel: ${report.reservationAudit.duplicateCancelError}`);
if (writeFiles) console.log(`Wrote ${MARKDOWN_OUT}, ${JSON_OUT}`);
if (!report.passed) process.exitCode = 1;

async function writeFile(path: string, content: string): Promise<void> {
  await fs.mkdir(dirname(path), { recursive: true });
  await fs.writeFile(path, content, "utf8");
}
