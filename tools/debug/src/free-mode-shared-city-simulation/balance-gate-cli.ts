import {
  formatFreeModeBalanceGateResult,
  runFreeModeBalanceGate
} from "./balance-gate";
import { resolveScenarioNames } from "./scenarios";

declare const process: {
  argv: string[];
  exitCode?: number;
};

const options = Object.fromEntries(
  process.argv.slice(2).map((entry: string) => {
    const [key, value = "true"] = entry.replace(/^--/, "").split("=");
    return [key, value];
  })
);

const result = await runFreeModeBalanceGate(
  resolveScenarioNames(typeof options.scenarios === "string" ? options.scenarios : undefined)
);

if (options.json === "true") {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(formatFreeModeBalanceGateResult(result));
}

process.exitCode = result.hardPassed ? 0 : 1;
