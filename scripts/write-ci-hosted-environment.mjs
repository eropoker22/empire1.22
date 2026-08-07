import { randomBytes } from "node:crypto";
import { appendFile } from "node:fs/promises";

const githubEnvironmentPath = String(process.env.GITHUB_ENV ?? "").trim();
if (process.env.CI !== "true" || process.env.GITHUB_ACTIONS !== "true" || !githubEnvironmentPath) {
  throw new Error("CI hosted environment generation is restricted to GitHub Actions.");
}

const runtimeDatabaseUrl = "postgresql://empire@127.0.0.1:5432/postgres";
const testDatabaseUrl = "postgresql://empire@127.0.0.1:5432/empire_e2e";
const secret = () => randomBytes(32).toString("base64url");
const databaseEnvironment = {
  EMPIRE_DATABASE_URL: runtimeDatabaseUrl,
  GAMEPLAY_DATABASE_URL: runtimeDatabaseUrl,
  EMPIRE_TEST_DATABASE_URL: testDatabaseUrl
};
const secretEnvironment = {
  GAMEPLAY_SLICE_SESSION_SECRET: secret(),
  GAMEPLAY_SLICE_SNAPSHOT_SECRET: secret(),
  EMPIRE_ADMIN_FINGERPRINT_SECRET: secret(),
  EMPIRE_ADMIN_SESSION_SECRET: secret(),
  EMPIRE_AUTH_THROTTLE_PEPPER: secret(),
  EMPIRE_ADMIN_BOOTSTRAP_PASSWORD: secret()
};
const values = { ...databaseEnvironment, ...secretEnvironment };
const secretValues = Object.values(secretEnvironment);

if (secretValues.length !== 6 || new Set(secretValues).size !== secretValues.length) {
  throw new Error("CI hosted environment generator produced a duplicate secret.");
}
for (const value of secretValues) {
  console.log(`::add-mask::${value}`);
}
await appendFile(
  githubEnvironmentPath,
  `${Object.entries(values).map(([name, value]) => `${name}=${value}`).join("\n")}\n`,
  { encoding: "utf8", mode: 0o600 }
);
console.log("Generated isolated CI database settings and registered six distinct ephemeral secrets with GitHub log masking.");
