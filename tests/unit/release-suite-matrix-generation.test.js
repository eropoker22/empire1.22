import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  checkReleaseSuiteMatrixSources,
  findMissingHostedAcceptanceSuites,
  RELEASE_SUITE_MATRIX_TARGETS,
  replaceGeneratedSuiteBlock
} from "../../scripts/generate-release-suite-matrices.mjs";
import {
  HOSTED_ACCEPTANCE_SUITE_NAMES,
  REMOTE_STAGING_ACCEPTANCE_SUITE_NAMES
} from "../../scripts/remote-staging-acceptance-suites.mjs";

const currentSources = () => Object.fromEntries(
  RELEASE_SUITE_MATRIX_TARGETS.map(({ relativePath }) => [
    relativePath,
    readFileSync(relativePath, "utf8")
  ])
);

describe("generated release suite matrices", () => {
  it("keeps hosted, deploy-evidence and remote matrices generated from one registry", () => {
    expect(checkReleaseSuiteMatrixSources(currentSources())).toEqual([]);
    expect(REMOTE_STAGING_ACCEPTANCE_SUITE_NAMES).toContain("canonical-20p-registration");
  });

  it("requires every hosted matrix suite to exist in the local-hosted runner", () => {
    const runner = readFileSync("scripts/run-local-hosted-full.mjs", "utf8");
    expect(findMissingHostedAcceptanceSuites(runner)).toEqual([]);
    expect(findMissingHostedAcceptanceSuites(
      runner.replace('name: "canonical-20p-registration"', 'name: "omitted-canonical-suite"')
    )).toContain("canonical-20p-registration");
  });

  it("detects a suite omitted from any generated workflow block", () => {
    const sources = currentSources();
    const remotePath = ".github/workflows/staging-remote-acceptance.yml";
    sources[remotePath] = sources[remotePath].replace(
      /          - label: remote-canonical-20p-registration\r?\n            suite: canonical-20p-registration\r?\n            timeout: 60\r?\n            fixture: false\r?\n            restart_worker: false\r?\n/u,
      ""
    );
    expect(checkReleaseSuiteMatrixSources(sources)).toContain(remotePath);
  });

  it("renders every registered suite exactly once into both matrices", () => {
    const sources = currentSources();
    for (const [target, suiteNames] of [
      [RELEASE_SUITE_MATRIX_TARGETS[0], HOSTED_ACCEPTANCE_SUITE_NAMES],
      [RELEASE_SUITE_MATRIX_TARGETS[1], REMOTE_STAGING_ACCEPTANCE_SUITE_NAMES]
    ]) {
      const rendered = replaceGeneratedSuiteBlock(sources[target.relativePath], target);
      for (const suiteName of suiteNames) {
        expect(rendered.match(new RegExp(`^\\s+suite: ${suiteName}\\s*$`, "gmu"))).toHaveLength(1);
      }
    }
  });
});
