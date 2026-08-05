import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const verifyLocalHostedSummary = async ({ root, expectedSha, expectedSuite }) => {
  const resolvedRoot = path.resolve(root || ".tmp/local-hosted-full");
  if (!/^[0-9a-f]{40}$/u.test(expectedSha) || !expectedSuite) {
    throw new Error("Hosted summary verification requires a 40-character SHA and suite name.");
  }
  const summaries = await findSummaries(resolvedRoot);
  if (summaries.length === 0) throw new Error(`No hosted summary.json found under ${resolvedRoot}.`);
  const selected = summaries.sort((left, right) => right.localeCompare(left))[0];
  const summary = JSON.parse(await readFile(selected, "utf8"));
  const suite = summary.suites?.find((entry) => entry.name === expectedSuite);
  if (summary.buildSha !== expectedSha) throw new Error("Hosted summary build SHA does not equal the workflow SHA.");
  if (summary.succeeded !== true || !suite || suite.status !== "passed") {
    throw new Error(`Hosted suite ${expectedSuite} did not pass.`);
  }
  const runs = suite.evidence?.playwrightRuns;
  if (!Array.isArray(runs) || runs.length === 0) throw new Error("Hosted summary has no Playwright release counts.");
  for (const run of runs) {
    const counts = run.counts || {};
    if (run.status !== "passed" || !(counts.total > 0) || counts.failed !== 0 || counts.skipped !== 0
      || counts.notRun !== 0 || counts.retries !== 0 || counts.flaky !== 0) {
      throw new Error(`Hosted Playwright phase ${run.phase || "unknown"} is NOT RUN or not clean.`);
    }
  }
  return { summaryPath: selected, runCount: runs.length };
};

async function main() {
  const rootArgument = process.argv.find((argument) => argument.startsWith("--root="));
  const shaArgument = process.argv.find((argument) => argument.startsWith("--sha="));
  const suiteArgument = process.argv.find((argument) => argument.startsWith("--suite="));
  const expectedSha = shaArgument?.slice("--sha=".length) || "";
  const expectedSuite = suiteArgument?.slice("--suite=".length) || "";
  const result = await verifyLocalHostedSummary({
    root: rootArgument?.slice("--root=".length),
    expectedSha,
    expectedSuite
  });
  console.log(`PASS hosted summary suite=${expectedSuite} sha=${expectedSha} runs=${result.runCount}`);
  console.log(`Artifact: ${path.relative(process.cwd(), result.summaryPath)}`);
}

async function findSummaries(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return findSummaries(target);
    return entry.isFile() && entry.name === "summary.json" ? [target] : [];
  }));
  return nested.flat();
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  await main();
}
