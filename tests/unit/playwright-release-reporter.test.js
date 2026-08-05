import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import PlaywrightReleaseReporter from "../../scripts/playwright-release-reporter.mjs";
import { verifyLocalHostedSummary } from "../../scripts/verify-local-hosted-summary.mjs";

const cleanup = [];
afterEach(async () => Promise.all(cleanup.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))));

describe("Playwright release reporter", () => {
  it("accepts only a non-empty clean run without skips or retries", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "empire-release-reporter-"));
    cleanup.push(directory);
    const summaryPath = path.join(directory, "summary.json");
    const reporter = new PlaywrightReleaseReporter({ summaryPath });
    reporter.onBegin({}, { allTests: () => [{ id: "test:1" }] });
    reporter.onTestEnd({ id: "test:1", expectedStatus: "passed" }, { status: "passed", retry: 0 });
    await expect(reporter.onEnd({ status: "passed" })).resolves.toBeUndefined();
    await expect(readFile(summaryPath, "utf8").then(JSON.parse)).resolves.toMatchObject({
      status: "passed",
      counts: { total: 1, passed: 1, skipped: 0, notRun: 0, retries: 0 }
    });
  });

  it.each([
    { expectedStatus: "skipped", status: "skipped", retry: 0 },
    { expectedStatus: "passed", status: "passed", retry: 1 }
  ])("marks skipped or retried tests as not passed", async (result) => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "empire-release-reporter-"));
    cleanup.push(directory);
    const reporter = new PlaywrightReleaseReporter({ summaryPath: path.join(directory, "summary.json") });
    reporter.onBegin({}, { allTests: () => [{ id: "test:1" }] });
    reporter.onTestEnd({ id: "test:1", expectedStatus: result.expectedStatus }, result);
    await expect(reporter.onEnd({ status: "passed" })).resolves.toEqual({ status: "failed" });
  });
});

describe("local hosted release summary", () => {
  it("requires exact SHA and clean non-skipped Playwright evidence", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "empire-hosted-summary-"));
    cleanup.push(directory);
    const sha = "a".repeat(40);
    const summaryPath = path.join(directory, "2026-08-05", "summary.json");
    const cleanRun = {
      phase: "acceptance",
      status: "passed",
      counts: { total: 2, failed: 0, skipped: 0, notRun: 0, retries: 0, flaky: 0 }
    };
    await mkdir(path.dirname(summaryPath), { recursive: true });
    await writeFile(summaryPath, JSON.stringify({
      buildSha: sha,
      succeeded: true,
      suites: [{ name: "manual-admin-player", status: "passed", evidence: { playwrightRuns: [cleanRun] } }]
    }), "utf8");
    await expect(verifyLocalHostedSummary({
      root: directory,
      expectedSha: sha,
      expectedSuite: "manual-admin-player"
    })).resolves.toMatchObject({ summaryPath, runCount: 1 });

    cleanRun.counts.skipped = 1;
    await writeFile(summaryPath, JSON.stringify({
      buildSha: sha,
      succeeded: true,
      suites: [{ name: "manual-admin-player", status: "passed", evidence: { playwrightRuns: [cleanRun] } }]
    }), "utf8");
    await expect(verifyLocalHostedSummary({
      root: directory,
      expectedSha: sha,
      expectedSuite: "manual-admin-player"
    })).rejects.toThrow(/NOT RUN/u);
  });
});
