import { execFileSync } from "node:child_process";
import {
  PRODUCTION_COMPONENTS,
  validateProductionEnvironment
} from "./production-release-contract.mjs";

const componentArgument = process.argv.find((argument) => argument.startsWith("--component="));
const component = componentArgument?.slice("--component=".length) || "netlify";
const allowRegistrationEnabled = process.argv.includes("--allow-registration-enabled");
const json = process.argv.includes("--json");

if (!PRODUCTION_COMPONENTS.has(component)) {
  console.error("Production environment validation requires --component=netlify, worker or migration.");
  process.exit(1);
}

let gitSha = null;
try {
  gitSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
} catch {
  console.error("Production environment validation could not read the checkout HEAD.");
}

const result = validateProductionEnvironment(process.env, {
  allowRegistrationEnabled,
  component,
  gitSha
});

if (json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  for (const check of result.checks) {
    console.log(`${check.passed ? "PASS" : "FAIL"} ${check.name} [${check.component}]`
      + ` required=${check.required ? "yes" : "no"} set=${check.set ? "yes" : "no"} format=${check.safeFormat}`);
  }
}

if (!result.passed) {
  console.error("Production environment validation failed. Secret values and database URLs were not printed.");
  process.exitCode = 1;
} else {
  console.log(`Production ${result.component} environment validation passed in ${result.connectionMode} mode.`);
  console.log("Secret values and database URLs were not printed.");
}
