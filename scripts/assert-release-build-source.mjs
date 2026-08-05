import { execFileSync } from "node:child_process";
import { validateReleaseBuildSource } from "./release-build-source-contract.mjs";

const result = validateReleaseBuildSource({
  releaseEnvironment: process.env.EMPIRE_RELEASE_ENVIRONMENT,
  configuredSha: String(process.env.EMPIRE_BUILD_SHA ?? "").trim(),
  gitSha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  worktreeStatus: execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], { encoding: "utf8" }).trim()
});
console.log(result.publicRelease ? `Release build source verified for ${result.buildSha}.` : "Release build source check: local mode.");
