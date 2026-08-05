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
});
