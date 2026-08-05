import { describe, expect, it } from "vitest";
import { validateReleaseDatabaseEndpoints } from "../../scripts/release-database-endpoint-contract.mjs";

const credential = ["fixture-user", "fixture-password"].join(":");
const endpoint = (hostname, database = "empire", sslmode = "verify-full") =>
  `postgresql://${credential}@${hostname}/${database}?sslmode=${sslmode}`;
const validEnvironment = {
  EMPIRE_RELEASE_DATABASE_URL_DIRECT: endpoint("ep-release.eu-central-1.aws.neon.tech"),
  GAMEPLAY_RELEASE_DATABASE_URL_DIRECT: endpoint("ep-release.eu-central-1.aws.neon.tech"),
  EMPIRE_RELEASE_DATABASE_URL_POOLED: endpoint("ep-release-pooler.eu-central-1.aws.neon.tech"),
  GAMEPLAY_RELEASE_DATABASE_URL_POOLED: endpoint("ep-release-pooler.eu-central-1.aws.neon.tech")
};

describe("release database endpoint contract", () => {
  it("accepts one Neon target with direct and pooled TLS endpoints", () => {
    const result = validateReleaseDatabaseEndpoints(validEnvironment);
    expect(result).toMatchObject({
      provider: "neon",
      providerHostnameHash: expect.stringMatching(/^[0-9a-f]{16}$/u),
      databaseNameHash: expect.stringMatching(/^[0-9a-f]{16}$/u),
      directConnectionMode: "direct",
      pooledConnectionMode: "pooled",
      directSslModes: ["verify-full"],
      pooledSslModes: ["verify-full"]
    });
    expect(JSON.stringify(result)).not.toContain("ep-release");
  });

  it.each([
    ["wrong pool mode", { EMPIRE_RELEASE_DATABASE_URL_POOLED: endpoint("ep-release.eu-central-1.aws.neon.tech") }, "RELEASE_DATABASE_ENDPOINT_INVALID"],
    ["different branch", { GAMEPLAY_RELEASE_DATABASE_URL_POOLED: endpoint("ep-other-pooler.eu-central-1.aws.neon.tech") }, "RELEASE_DATABASE_ENDPOINT_TARGET_MISMATCH"],
    ["different database", { GAMEPLAY_RELEASE_DATABASE_URL_DIRECT: endpoint("ep-release.eu-central-1.aws.neon.tech", "other") }, "RELEASE_DATABASE_ENDPOINT_TARGET_MISMATCH"],
    ["missing TLS", { EMPIRE_RELEASE_DATABASE_URL_DIRECT: endpoint("ep-release.eu-central-1.aws.neon.tech", "empire", "disable") }, "RELEASE_DATABASE_ENDPOINT_INVALID"],
    ["non-Neon provider", { EMPIRE_RELEASE_DATABASE_URL_DIRECT: endpoint("db.example.com") }, "RELEASE_DATABASE_ENDPOINT_INVALID"]
  ])("rejects %s", (_label, override, code) => {
    expect(() => validateReleaseDatabaseEndpoints({ ...validEnvironment, ...override })).toThrow(code);
  });
});
