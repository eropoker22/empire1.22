import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assertExplicitLivePostgresTestEnvironment } from
  "../../scripts/require-live-postgres-test-environment.mjs";
import { resolveLivePostgresSmokeConfig } from
  "./helpers/postgres-prod-like-smoke-helpers";

const packageJson = JSON.parse(readFileSync(
  new URL("../../package.json", import.meta.url),
  "utf8"
));
const persistenceDirectory = new URL("./", import.meta.url);
const liveTestFiles = readdirSync(persistenceDirectory)
  .filter((filename) => filename.endsWith("-live.test.ts")
    || filename === "postgres-prod-like-smoke.test.ts")
  .sort();
const liveExclusions = [
  "--exclude tests/persistence/**/*-live.test.ts",
  "--exclude tests/persistence/postgres-prod-like-smoke.test.ts"
];

describe("persistence suite boundary", () => {
  it("keeps every live Postgres test out of default persistence and coverage runs", () => {
    expect(liveTestFiles.length).toBeGreaterThan(0);
    for (const scriptName of ["test:persistence", "coverage:check"]) {
      const command = packageJson.scripts[scriptName];
      for (const exclusion of liveExclusions) expect(command).toContain(exclusion);
    }
  });

  it("wires every live Postgres test into the explicit live suite", () => {
    const command = packageJson.scripts["test:persistence:postgres:live"];
    for (const filename of liveTestFiles) {
      expect(command).toContain(`tests/persistence/${filename}`);
    }
    expect(packageJson.scripts["pretest:persistence:postgres:live"])
      .toContain("require-live-postgres-test-environment.mjs");
  });

  it("does not load local env files from live Postgres tests", () => {
    const helperSource = readFileSync(
      new URL("./helpers/postgres-prod-like-smoke-helpers.ts", import.meta.url),
      "utf8"
    );
    expect(helperSource).not.toContain("loadLocalEnvFile");

    for (const filename of liveTestFiles) {
      const source = readFileSync(new URL(filename, persistenceDirectory), "utf8");
      expect(source, filename).not.toContain("loadLocalEnvFile");
      expect(source, filename).toContain("resolveLivePostgresSmokeConfig");
    }
  });

  it("requires an explicit test URL and ignores runtime database variables", () => {
    expect(() => assertExplicitLivePostgresTestEnvironment({}))
      .toThrow("EMPIRE_TEST_DATABASE_URL");
    expect(() => assertExplicitLivePostgresTestEnvironment({
      EMPIRE_DATABASE_URL: "postgresql://runtime.example.invalid/empire"
    })).toThrow("EMPIRE_TEST_DATABASE_URL");
    expect(assertExplicitLivePostgresTestEnvironment({
      EMPIRE_TEST_DATABASE_URL: "postgresql://test.example.invalid/empire_test"
    })).toBe(true);
  });

  it("keeps rejected database credentials out of guard errors", () => {
    const sensitiveUrl =
      "postgresql://sensitive-user:sensitive-password@database.example.invalid/empire";
    let message = "";
    try {
      resolveLivePostgresSmokeConfig({ EMPIRE_TEST_DATABASE_URL: sensitiveUrl });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain("does not look like an isolated test target");
    expect(message).not.toContain(sensitiveUrl);
    expect(message).not.toContain("sensitive-user");
    expect(message).not.toContain("sensitive-password");
  });
});
