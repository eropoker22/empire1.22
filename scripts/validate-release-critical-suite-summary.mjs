import { readFile } from "node:fs/promises";
import {
  validateReleaseCriticalSuiteSummary
} from "./pre-alpha-staging-contract.mjs";
import {
  getRemoteStagingAcceptanceSuite
} from "./remote-staging-acceptance-suites.mjs";

const argument = (name) => {
  const prefix = `${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? "";
};

const summaryPath = argument("--summary");
const suiteName = argument("--suite");
const buildSha = argument("--build-sha");
if (!summaryPath || !suiteName || !buildSha) {
  throw new Error("PRE_ALPHA_REMOTE_VALIDATOR_ARGUMENTS_REQUIRED");
}
const suite = getRemoteStagingAcceptanceSuite(suiteName);
if (!suite) throw new Error(`PRE_ALPHA_REMOTE_SUITE_UNKNOWN:${suiteName}`);
const summary = JSON.parse(await readFile(summaryPath, "utf8"));
validateReleaseCriticalSuiteSummary(summary, { suite, buildSha });
console.log(JSON.stringify({ status: "passed", suite: suiteName, buildSha }));
