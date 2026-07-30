const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const TEST_DATABASE_PATTERN = /(?:^|[_-])(test|e2e)(?:[_-]|$)/iu;

export function assertSafeHostedE2eFixtureEnvironment({
  databaseUrl,
  fixturesEnabled,
  nodeEnv
}) {
  if (String(nodeEnv || "").trim().toLowerCase() !== "test") {
    throw new Error("Hosted E2E fixtures require NODE_ENV=test.");
  }
  if (String(fixturesEnabled || "").trim() !== "1") {
    throw new Error("Hosted E2E fixtures require EMPIRE_HOSTED_E2E_FIXTURES=1.");
  }
  const database = parseDatabaseUrl(databaseUrl, "EMPIRE_DATABASE_URL");
  if (!LOOPBACK_HOSTS.has(database.hostname)) {
    throw new Error("Hosted E2E fixtures require a loopback PostgreSQL host.");
  }
  const databaseName = decodeURIComponent(database.pathname.replace(/^\/+/u, ""));
  if (!TEST_DATABASE_PATTERN.test(databaseName)) {
    throw new Error("Hosted E2E fixture database name must explicitly contain test or e2e.");
  }
  return Object.freeze({
    databaseName,
    hostname: database.hostname,
    port: database.port || "5432"
  });
}

export function assertSafeLocalHostedTestDatabase({
  runtimeDatabaseUrl,
  testDatabaseUrl,
  nodeEnv
}) {
  if (String(nodeEnv || "").trim().toLowerCase() === "production") {
    throw new Error("Local hosted tests refuse to run with NODE_ENV=production.");
  }
  const runtime = parseDatabaseUrl(runtimeDatabaseUrl, "EMPIRE_DATABASE_URL");
  const test = parseDatabaseUrl(testDatabaseUrl, "EMPIRE_TEST_DATABASE_URL");
  if (runtime.href === test.href) {
    throw new Error("Local hosted tests require separate runtime and test database URLs.");
  }
  if (!LOOPBACK_HOSTS.has(test.hostname)) {
    throw new Error("Local hosted tests require a loopback PostgreSQL host.");
  }
  const databaseName = decodeURIComponent(test.pathname.replace(/^\/+/u, ""));
  if (!TEST_DATABASE_PATTERN.test(databaseName)) {
    throw new Error("Local hosted test database name must explicitly contain test or e2e.");
  }
  return Object.freeze({
    databaseName,
    hostname: test.hostname,
    port: test.port || "5432"
  });
}

function parseDatabaseUrl(value, variableName) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`${variableName} is required.`);
  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error(`${variableName} must be a valid PostgreSQL URL.`);
  }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error(`${variableName} must use PostgreSQL.`);
  }
  return parsed;
}
