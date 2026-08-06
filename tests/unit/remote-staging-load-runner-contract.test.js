import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const runner = readFileSync("scripts/run-remote-staging-load-soak.mjs", "utf8");

describe("remote staging load runner evidence", () => {
  it("promotes the measured weighted action mix into the guarded summary", () => {
    expect(runner).toContain("evidence.performance = loadResult.performance");
    expect(runner).toContain('performanceReport?.metrics?.passed !== true');
    expect(runner).toContain("distinctActualActionCount) < 5");
    expect(runner).toContain("distinctAcceptedActionCount) < 4");
    expect(runner).toContain("districtSelectionChangeCount) < 1");
    expect(runner).toContain("rejectionClassification?.auth) !== 0");
    expect(runner).toContain("rejectionClassification?.rateLimit) !== 0");
    expect(runner).toContain("rejectionClassification?.unexpected) !== 0");
  });

  it("does not copy raw per-player action samples into summary.json", () => {
    const promoted = runner.slice(
      runner.indexOf("const performance = {"),
      runner.indexOf("return { playwright, performance, database, fly }")
    );
    expect(promoted).not.toContain("actionSamples");
    expect(promoted).not.toContain("identities");
    expect(promoted).toContain("metrics: performanceReport.metrics");
  });
});
