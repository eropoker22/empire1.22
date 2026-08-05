import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export default class PlaywrightReleaseReporter {
  constructor(options = {}) {
    this.summaryPath = String(options.summaryPath || process.env.EMPIRE_PLAYWRIGHT_RELEASE_SUMMARY || "").trim();
    this.startedAt = Date.now();
    this.total = 0;
    this.tests = new Map();
  }

  onBegin(_config, suite) {
    this.startedAt = Date.now();
    this.total = suite.allTests().length;
    console.log(`[release-playwright] selected=${this.total}`);
  }

  onTestEnd(test, result) {
    const current = this.tests.get(test.id) || { expectedStatus: test.expectedStatus, results: [] };
    current.results.push({ status: result.status, retry: result.retry });
    this.tests.set(test.id, current);
  }

  async onEnd(result) {
    const finalResults = [...this.tests.values()].map((test) => ({
      expectedStatus: test.expectedStatus,
      attempts: test.results.length,
      finalStatus: test.results.at(-1)?.status || "not-run",
      retries: Math.max(0, ...test.results.map((entry) => Number(entry.retry) || 0))
    }));
    const counts = {
      total: this.total,
      executed: finalResults.length,
      passed: finalResults.filter((test) => test.finalStatus === "passed").length,
      failed: finalResults.filter((test) => ["failed", "timedOut", "interrupted"].includes(test.finalStatus)).length,
      skipped: finalResults.filter((test) => test.finalStatus === "skipped" || test.expectedStatus === "skipped").length,
      notRun: Math.max(0, this.total - finalResults.length),
      retries: finalResults.reduce((sum, test) => sum + test.retries, 0),
      flaky: finalResults.filter((test) => test.finalStatus === "passed" && test.attempts > 1).length
    };
    const gatePassed = result.status === "passed" && counts.total > 0 && counts.failed === 0
      && counts.skipped === 0 && counts.notRun === 0 && counts.retries === 0 && counts.flaky === 0;
    const summary = {
      status: gatePassed ? "passed" : "not-passed",
      playwrightStatus: result.status,
      durationMs: Date.now() - this.startedAt,
      counts
    };
    if (!this.summaryPath) {
      console.error("[release-playwright] EMPIRE_PLAYWRIGHT_RELEASE_SUMMARY is required.");
      return { status: "failed" };
    }
    await mkdir(path.dirname(this.summaryPath), { recursive: true });
    await writeFile(this.summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    console.log(`[release-playwright] status=${summary.status} total=${counts.total} skipped=${counts.skipped}`
      + ` retries=${counts.retries} notRun=${counts.notRun}`);
    return gatePassed ? undefined : { status: "failed" };
  }

  printsToStdio() {
    return true;
  }
}
