import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export default class PlaywrightReleaseReporter {
  constructor(options = {}) {
    this.summaryPath = String(options.summaryPath || process.env.EMPIRE_PLAYWRIGHT_RELEASE_SUMMARY || "").trim();
    this.startedAt = Date.now();
    this.total = 0;
    this.tests = new Map();
    this.errors = [];
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
    const title = typeof test.titlePath === "function"
      ? test.titlePath().filter(Boolean).join(" > ")
      : String(test.title || test.id || "Unknown Playwright test");
    const resultErrors = Array.isArray(result.errors) && result.errors.length > 0
      ? result.errors
      : result.error
        ? [result.error]
        : [];
    for (const error of resultErrors) {
      const diagnostic = formatErrorDiagnostic({
        message: `${title}: ${error?.message || error?.value || String(error)}`
      });
      if (!diagnostic || this.errors.includes(diagnostic)) continue;
      this.errors.push(diagnostic);
      console.error(`[release-playwright] test-error=${diagnostic}`);
    }
  }

  onError(error) {
    const diagnostic = formatErrorDiagnostic(error);
    this.errors.push(diagnostic);
    console.error(`[release-playwright] error=${diagnostic}`);
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
    const gatePassed = result.status === "passed" && this.errors.length === 0
      && counts.total > 0 && counts.failed === 0
      && counts.skipped === 0 && counts.notRun === 0 && counts.retries === 0 && counts.flaky === 0;
    const summary = {
      status: gatePassed ? "passed" : "not-passed",
      playwrightStatus: result.status,
      durationMs: Date.now() - this.startedAt,
      counts,
      errors: this.errors
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

function formatErrorDiagnostic(error) {
  const raw = typeof error === "string"
    ? error
    : error?.message || error?.value || "Unknown Playwright error.";
  return String(raw)
    .replace(/(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s,;]+/giu, "[redacted]")
    .replace(/(?:bearer|basic|flyv1)\s+[A-Za-z0-9._~+/=-]+/giu, "[redacted]")
    .replace(/\b(?:gh[pousr]_|github_pat_|npm_|sk-)[A-Za-z0-9_-]+\b/giu, "[redacted]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/gu, "[redacted]")
    .replace(
      /(["']?(?:password|passwd|passphrase|secret|client[_-]?secret|token|cookie|set-cookie|authorization|auth(?:orization)?[_-]?header|credential|x-api-key|api[_-]?key|private[_-]?key|access[_-]?key|database[_-]?url|db[_-]?url|connection[_-]?string|dsn|email|dob|birth[_-]?date|username|nickname|gang[_-]?name|alliance[_-]?name|display[_-]?name|network[_-]?identifier|ip[_-]?address|player[_-]?id|account[_-]?id|server(?:[_-]?instance)?[_-]?id|session[_-]?id|membership[_-]?id)["']?\s*[:=]\s*)(?:"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|[^\s,;}]+)/giu,
      "$1[redacted]"
    )
    .replace(/([a-z][a-z0-9+.-]*:\/\/)[^/\s:@]+:[^/\s@]+@/giu, "$1[redacted]@")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, "[redacted-email]")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/giu, "[redacted-id]")
    .replace(/\b(?:player|account|server|session|membership):[A-Za-z0-9:._-]+/giu, "[redacted-id]")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, "")
    .trim()
    .slice(0, 4_000);
}
