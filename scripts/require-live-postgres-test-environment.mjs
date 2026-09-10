import { pathToFileURL } from "node:url";

const REQUIRED_MESSAGE =
  "Live Postgres persistence tests require EMPIRE_TEST_DATABASE_URL to be set explicitly; local env files are not loaded.";
const INVALID_MESSAGE =
  "EMPIRE_TEST_DATABASE_URL must be a valid PostgreSQL connection URL.";
const REMOTE_OPT_IN_MESSAGE =
  "Remote database tests require EMPIRE_ALLOW_REMOTE_DATABASE_TESTS=true and an explicit staging target.";

export const assertExplicitLivePostgresTestEnvironment = (
  environment = process.env
) => {
  const databaseUrl = String(environment.EMPIRE_TEST_DATABASE_URL ?? "").trim();
  if (!databaseUrl) throw new Error(REQUIRED_MESSAGE);

  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error(INVALID_MESSAGE);
  }

  if (!["postgres:", "postgresql:"].includes(parsed.protocol)
    || !parsed.hostname
    || !parsed.pathname.replace(/^\/+/, "")) {
    throw new Error(INVALID_MESSAGE);
  }

  const remote = isRemoteDatabaseHost(parsed.hostname);
  if (remote && (environment.EMPIRE_ALLOW_REMOTE_DATABASE_TESTS !== "true"
    || environment.EMPIRE_RELEASE_ENVIRONMENT !== "staging")) {
    throw new Error(REMOTE_OPT_IN_MESSAGE);
  }
  if (remote && environment.CI === "true" && environment.GITHUB_EVENT_NAME !== "workflow_dispatch") {
    throw new Error("Remote staging database tests in CI require an explicit workflow_dispatch run.");
  }

  return true;
};

const isRemoteDatabaseHost = (hostname) => {
  const normalized = String(hostname ?? "").trim().toLowerCase();
  if (["localhost", "127.0.0.1", "::1", "[::1]", "postgres", "database", "db"].includes(normalized)) {
    return false;
  }
  return normalized.endsWith(".neon.tech") || normalized.includes(".");
};

const invokedDirectly = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  try {
    assertExplicitLivePostgresTestEnvironment();
  } catch (error) {
    console.error(error instanceof Error ? error.message : REQUIRED_MESSAGE);
    process.exitCode = 1;
  }
}
