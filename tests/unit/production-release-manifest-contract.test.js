import { describe, expect, it } from "vitest";
import { createProductionReleaseManifest } from "../../scripts/production-release-manifest-contract.mjs";

const SHA = "82ab0778704c755170048d9509036eb3f03909da";

describe("production release manifest", () => {
  it("pins frontend, API and worker to one production SHA", () => {
    expect(createProductionReleaseManifest({
      gitSha: SHA,
      expectedSchemaVersion: "015_account_age_requirement.sql",
      nodeVersion: "24.18.0",
      npmVersion: "11.6.2",
      createdAt: "2026-08-05T10:00:00.000Z"
    })).toEqual({
      gitSha: SHA,
      frontendBuildSha: SHA,
      apiBuildSha: SHA,
      workerBuildSha: SHA,
      expectedSchemaVersion: "015_account_age_requirement.sql",
      nodeVersion: "24.18.0",
      nodeMajor: 24,
      npmVersion: "11.6.2",
      createdAt: "2026-08-05T10:00:00.000Z",
      buildTimestamp: "2026-08-05T10:00:00.000Z",
      environment: "production",
      targetEnvironment: "production",
      verificationMode: "production-environment"
    });
  });

  it.each([
    ["invalid SHA", { gitSha: "main" }, "PRODUCTION_MANIFEST_SHA_INVALID"],
    ["invalid schema", { expectedSchemaVersion: "latest" }, "PRODUCTION_MANIFEST_SCHEMA_INVALID"],
    ["invalid Node", { nodeVersion: "26.0.0" }, "PRODUCTION_MANIFEST_NODE_INVALID"],
    ["invalid npm", { npmVersion: "latest" }, "PRODUCTION_MANIFEST_NPM_INVALID"],
    ["invalid time", { createdAt: "today" }, "PRODUCTION_MANIFEST_TIME_INVALID"]
  ])("rejects %s", (_label, override, code) => {
    expect(() => createProductionReleaseManifest({
      gitSha: SHA,
      expectedSchemaVersion: "015_account_age_requirement.sql",
      nodeVersion: "24.18.0",
      npmVersion: "11.6.2",
      createdAt: "2026-08-05T10:00:00.000Z",
      ...override
    })).toThrow(code);
  });
});
