import { describe, expect, it } from "vitest";
import {
  assertSafeHostedE2eFixtureEnvironment,
  assertSafeLocalHostedTestDatabase
} from "../../scripts/local-hosted/database-safety.mjs";

const runtimeUrl = "postgresql://runtime@127.0.0.1:5432/empire_runtime";
const testUrl = "postgresql://tester@127.0.0.1:5432/empire_e2e_test";

describe("local hosted database safety", () => {
  it("accepts a separate loopback test database outside production", () => {
    expect(assertSafeLocalHostedTestDatabase({
      runtimeDatabaseUrl: runtimeUrl,
      testDatabaseUrl: testUrl,
      nodeEnv: "test"
    })).toMatchObject({
      databaseName: "empire_e2e_test",
      hostname: "127.0.0.1"
    });
  });

  it.each([
    ["production NODE_ENV", { nodeEnv: "production" }],
    ["the runtime database", { testDatabaseUrl: runtimeUrl }],
    ["a remote database", { testDatabaseUrl: "postgresql://tester@db.example.com/empire_e2e_test" }],
    ["a database without a test marker", { testDatabaseUrl: "postgresql://tester@127.0.0.1/empire_staging" }]
  ])("rejects %s", (_label, override) => {
    expect(() => assertSafeLocalHostedTestDatabase({
      runtimeDatabaseUrl: runtimeUrl,
      testDatabaseUrl: testUrl,
      nodeEnv: "test",
      ...override
    })).toThrow();
  });
});

describe("hosted E2E fixture database safety", () => {
  it("accepts an explicitly enabled test-only loopback fixture database", () => {
    expect(assertSafeHostedE2eFixtureEnvironment({
      databaseUrl: testUrl,
      fixturesEnabled: "1",
      nodeEnv: "test"
    })).toMatchObject({
      databaseName: "empire_e2e_test",
      hostname: "127.0.0.1"
    });
  });

  it.each([
    ["a non-test runtime", { nodeEnv: "development" }],
    ["a disabled fixture flag", { fixturesEnabled: "0" }],
    ["a remote database", { databaseUrl: "postgresql://tester@db.example.com/empire_e2e_test" }],
    ["a database without a test marker", { databaseUrl: "postgresql://tester@127.0.0.1/empire_staging" }]
  ])("rejects %s", (_label, override) => {
    expect(() => assertSafeHostedE2eFixtureEnvironment({
      databaseUrl: testUrl,
      fixturesEnabled: "1",
      nodeEnv: "test",
      ...override
    })).toThrow();
  });
});
