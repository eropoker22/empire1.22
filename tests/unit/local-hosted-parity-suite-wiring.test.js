import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const runnerSource = readFileSync(
  new URL("../../scripts/run-local-hosted-full.mjs", import.meta.url),
  "utf8"
);
const nonSpawnParitySpecSource = readFileSync(
  new URL("../e2e/live-hosted-non-spawn-building-parity.spec.js", import.meta.url),
  "utf8"
);
const packageJson = JSON.parse(readFileSync(
  new URL("../../package.json", import.meta.url),
  "utf8"
));
const socialConcurrencySpecSource = readFileSync(
  new URL("../e2e/live-hosted-social-concurrency-privacy.spec.js", import.meta.url),
  "utf8"
);
const socialVisibleUiSpecSource = readFileSync(
  new URL("../e2e/live-hosted-social-visible-ui.spec.js", import.meta.url),
  "utf8"
);

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

function getGroupValues(suiteSource, key) {
  return [...suiteSource.matchAll(new RegExp(`${key}: "([^"]+)"`, "gu"))]
    .map((match) => match[1]);
}

describe("local-hosted presentation parity suite wiring", () => {
  it("runs utility parity through the shared ui-parity suite", () => {
    const suiteSource = getHostedSuiteSource("ui-parity");

    expect(suiteSource).toContain("tests/e2e/live-demo-utility-modal-parity.spec.js");
    expect(suiteSource).toContain('name: "utility-modals"');
    expect(suiteSource).toContain('grep: "live/demo utility modal parity"');
    expect(suiteSource).toContain('name: "spawn-building-matrix-a"');
    expect(suiteSource).toContain('name: "spawn-building-matrix-b"');
    expect(suiteSource).toContain('name: "spawn-building-matrix-c"');
  });

  it("partitions every spawn matrix case into exactly one bounded group", () => {
    const suiteSource = getHostedSuiteSource("ui-parity");
    const groupPatterns = [...suiteSource.matchAll(
      /name: "spawn-building-matrix-[abc]",\s+grep: "([^"]+)"/gu
    )].map((match) => match[1]);
    const matrixKeys = [
      "park-night-cover",
      "industrial-recycle",
      "residential-arcade-garage",
      "industrial-power",
      "park-distribution",
      "industrial-armory-warehouse",
      "residential-recovery",
      "commercial-mall-pharmacy",
      "residential-school",
      "park-drug-lab",
      "commercial-mobility-exchange",
      "commercial-fitness"
    ];

    expect(groupPatterns).toHaveLength(3);
    for (const matrixKey of matrixKeys) {
      expect(groupPatterns.filter((pattern) => new RegExp(pattern, "u").test(matrixKey)))
        .toHaveLength(1);
    }
  });

  it("runs social parity through its dedicated suite", () => {
    const suiteSource = getHostedSuiteSource("ui-parity-social");

    expect(suiteSource).toContain("tests/e2e/live-demo-social-modal-parity.spec.js");
    const groupedKeys = getGroupValues(suiteSource, "EMPIRE_UI_PARITY_SOCIAL_BATCH_KEYS")
      .flatMap((value) => value.split(","));
    expect(groupedKeys).toEqual([
      "social-01",
      "social-02",
      "social-03",
      "social-04",
      "social-05"
    ]);
    expect(new Set(groupedKeys).size).toBe(groupedKeys.length);
  });

  it("splits non-spawn parity without dropping canonical matrix entries", () => {
    const suiteSource = getHostedSuiteSource("ui-parity-non-spawn");
    const groupedKeys = getGroupValues(suiteSource, "EMPIRE_UI_PARITY_NON_SPAWN_KEYS")
      .flatMap((value) => value.split(","));

    expect(groupedKeys.sort()).toEqual([
      "airport-lobby-club",
      "casino",
      "central-bank",
      "city-hall-parliament",
      "court-vip-lounge",
      "port",
      "stock-exchange"
    ]);
    expect(new Set(groupedKeys).size).toBe(groupedKeys.length);
    expect(nonSpawnParitySpecSource).toContain("Unknown non-spawn parity matrix keys");
  });

  it("runs guarded social races with five authoritative identities", () => {
    const suiteSource = getHostedSuiteSource("social-concurrency-privacy");

    expect(suiteSource).toContain('scenario: "social-concurrency-privacy"');
    expect(suiteSource).toContain(
      'gameplayInteraction: "mixed-visible-browser-ui-and-direct-authoritative-api"'
    );
    expect(suiteSource).toContain("playerCount: 5");
    expect(suiteSource).toContain(
      "tests/e2e/live-hosted-social-concurrency-privacy.spec.js"
    );
  });

  it("closes refresh-restored bounty windows before the visible market race", () => {
    expect(socialVisibleUiSpecSource).toMatch(
      /reloadHostedGame\(target\.page\),\s*reloadHostedGame\(hunter\.page\)[\s\S]*?closeBountyPanel\(target\.page\),\s*closeBountyPanel\(hunter\.page\)[\s\S]*?openPlayerMarket\(client\.page\)/u
    );
  });

  it("keeps social race authority and last-slot guards fail-closed", () => {
    expect(socialConcurrencySpecSource).toContain("identities.length !== 5");
    expect(socialConcurrencySpecSource).toContain("PLAYER_IDENTITY_MISMATCH");
    expect(socialConcurrencySpecSource).toContain("DISTRICT_CONFLICT_STATE_CHANGED");
    expect(socialConcurrencySpecSource).toContain("ALLIANCE_FULL");
    expect(socialConcurrencySpecSource).toContain("bountyReward * 2");
    expect(socialConcurrencySpecSource).toContain('fetch("/api/gameplay-slice/load"');
    expect(socialConcurrencySpecSource).toContain('openBountyPanel(client.page, "active")');
    expect(socialConcurrencySpecSource).toContain("const authoritativeRefresh = page.waitForResponse");
    expect(socialConcurrencySpecSource).toContain("amount: input.amount");
    expect(socialConcurrencySpecSource).toContain(
      "getCurrentReadModel?.()?.district?.districtId || null"
    );
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
      "multiplayer-visible-actions",
      "social-concurrency-privacy"
    ]));
  });
});
