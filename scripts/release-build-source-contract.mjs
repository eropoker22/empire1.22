const SHA_PATTERN = /^[0-9a-f]{40}$/u;
const PUBLIC_RELEASE_ENVIRONMENTS = new Set(["staging", "production"]);

export const validateReleaseBuildSource = ({
  releaseEnvironment,
  configuredSha,
  gitSha,
  worktreeStatus = "",
  publicBuild = false
}) => {
  const publicRelease = PUBLIC_RELEASE_ENVIRONMENTS.has(String(releaseEnvironment ?? "").trim());
  if (!publicRelease) {
    if (publicBuild) throw new Error("RELEASE_BUILD_ENVIRONMENT_INVALID");
    return { publicRelease: false, buildSha: null };
  }
  if (!SHA_PATTERN.test(String(configuredSha ?? ""))) throw new Error("RELEASE_BUILD_SHA_INVALID");
  if (!SHA_PATTERN.test(String(gitSha ?? "")) || configuredSha !== gitSha) {
    throw new Error("RELEASE_BUILD_SHA_MISMATCH");
  }
  if (String(worktreeStatus).trim()) throw new Error("RELEASE_BUILD_WORKTREE_DIRTY");
  return { publicRelease: true, buildSha: configuredSha };
};
