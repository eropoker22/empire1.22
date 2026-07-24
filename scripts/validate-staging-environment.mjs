import { validateStagingEnvironment } from "./staging-release-contract.mjs";

const allowRegistrationEnabled = process.argv.includes("--allow-registration-enabled");
const json = process.argv.includes("--json");
const result = validateStagingEnvironment(process.env, { allowRegistrationEnabled });

if (json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  for (const check of result.checks) {
    console.log(`${check.passed ? "PASS" : "FAIL"} ${check.name} [${check.component}]`
      + ` required=${check.required ? "yes" : "no"} set=${check.set ? "yes" : "no"} format=${check.safeFormat}`);
  }
}

if (!result.passed) {
  console.error("Staging environment validation failed. Secret values were not printed.");
  process.exitCode = 1;
} else {
  console.log("Staging environment validation passed. Secret values were not printed.");
}
