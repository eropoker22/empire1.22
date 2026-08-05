import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { validateReleaseBuildSource } from "../../scripts/release-build-source-contract.mjs";

const sha = "a".repeat(40);

describe("release build source contract", () => {
  it("requires one clean exact SHA for staging and production", () => {
    expect(validateReleaseBuildSource({
      releaseEnvironment: "staging",
      configuredSha: sha,
      gitSha: sha,
      worktreeStatus: ""
    })).toEqual({ publicRelease: true, buildSha: sha });
  });

  it.each([
    [{ configuredSha: "local" }, "RELEASE_BUILD_SHA_INVALID"],
    [{ configuredSha: "b".repeat(40) }, "RELEASE_BUILD_SHA_MISMATCH"],
    [{ worktreeStatus: "M tracked.ts" }, "RELEASE_BUILD_WORKTREE_DIRTY"]
  ])("rejects an unsafe public build", (override, code) => {
    expect(() => validateReleaseBuildSource({
      releaseEnvironment: "production",
      configuredSha: sha,
      gitSha: sha,
      worktreeStatus: "",
      ...override
    })).toThrow(code);
  });

  it("allows local builds without pretending they are public releases", () => {
    expect(validateReleaseBuildSource({ releaseEnvironment: "local-hosted" }))
      .toEqual({ publicRelease: false, buildSha: null });
  });

  it.each([undefined, "", "local-hosted", "preview"])(
    "rejects a public provider build without a release environment (%s)",
    (releaseEnvironment) => {
      expect(() => validateReleaseBuildSource({ releaseEnvironment, publicBuild: true }))
        .toThrow("RELEASE_BUILD_ENVIRONMENT_INVALID");
    }
  );

  it("fails the actual Netlify prebuild instead of entering local mode", () => {
    const result = spawnSync(process.execPath, ["scripts/assert-release-build-source.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        NETLIFY: "true",
        EMPIRE_RELEASE_ENVIRONMENT: "",
        EMPIRE_BUILD_SHA: ""
      }
    });
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain("RELEASE_BUILD_ENVIRONMENT_INVALID");
  });

  it("keeps the actual local prebuild available", () => {
    const environment = { ...process.env };
    delete environment.NETLIFY;
    delete environment.EMPIRE_RELEASE_ENVIRONMENT;
    delete environment.EMPIRE_BUILD_SHA;
    const result = spawnSync(process.execPath, ["scripts/assert-release-build-source.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: environment
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Release build source check: local mode.");
  });
});
