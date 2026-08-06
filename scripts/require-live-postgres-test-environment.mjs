import { pathToFileURL } from "node:url";

const REQUIRED_MESSAGE =
  "Live Postgres persistence tests require EMPIRE_TEST_DATABASE_URL to be set explicitly; local env files are not loaded.";
const INVALID_MESSAGE =
  "EMPIRE_TEST_DATABASE_URL must be a valid PostgreSQL connection URL.";

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

  return true;
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
