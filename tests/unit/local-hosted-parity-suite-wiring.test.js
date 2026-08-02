import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const runnerSource = readFileSync(
  new URL("../../scripts/run-local-hosted-full.mjs", import.meta.url),
  "utf8"
);
const packageJson = JSON.parse(readFileSync(
  new URL("../../package.json", import.meta.url),
  "utf8"
));

function getHostedSuiteSource(name) {
  const marker = `name: "${name}"`;
  const markerIndex = runnerSource.indexOf(marker);
  expect(markerIndex, `local-hosted suite ${name}`).toBeGreaterThanOrEqual(0);
  const nextSuiteIndex = runnerSource.indexOf("\n  Object.freeze({", markerIndex + marker.length);
  return runnerSource.slice(
    markerIndex,
    nextSuiteIndex === -1 ? runnerSource.length : nextSuiteIndex
  );
}

function getManualSuiteNames() {
  const command = packageJson.scripts["test:local-hosted:manual-full"];
  const suiteArgument = command
    .split(/\s+/u)
    .find((argument) => argument.startsWith("--suite="));
  expect(suiteArgument).toBeDefined();
  return new Set(suiteArgument.slice("--suite=".length).split(","));
}

describe("local-hosted presentation parity suite wiring", () => {
  it("runs utility parity through the shared ui-parity suite", () => {
    const suiteSource = getHostedSuiteSource("ui-parity");

    expect(suiteSource).toContain("tests/e2e/live-demo-utility-modal-parity.spec.js");
    expect(suiteSource).toContain('name: "utility-modals"');
    expect(suiteSource).toContain('grep: "live/demo utility modal parity"');
  });

  it("runs social parity through its dedicated suite", () => {
    const suiteSource = getHostedSuiteSource("ui-parity-social");

    expect(suiteSource).toContain("tests/e2e/live-demo-social-modal-parity.spec.js");
  });

  it("runs district-action parity with the three-player multiplayer fixture", () => {
    const suiteSource = getHostedSuiteSource("multiplayer-visible-actions");

    expect(suiteSource).toContain('scenario: "multiplayer-core"');
    expect(suiteSource).toContain("playerCount: 3");
    expect(suiteSource).toContain("tests/e2e/manual-hosted-district-actions-ui.spec.js");
    expect(suiteSource).toContain("tests/e2e/live-demo-district-action-overlay-parity.spec.js");
  });

  it("keeps every parity suite in both full local-hosted gates", () => {
    expect(packageJson.scripts["test:local-hosted:full"])
      .toBe("node scripts/run-local-hosted-full.mjs");

    const manualSuiteNames = getManualSuiteNames();
    expect([...manualSuiteNames]).toEqual(expect.arrayContaining([
      "ui-parity",
      "ui-parity-social",
      "multiplayer-visible-actions"
    ]));
  });
});
