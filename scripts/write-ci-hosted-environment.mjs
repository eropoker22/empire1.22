import { randomBytes } from "node:crypto";
import { appendFile } from "node:fs/promises";

const githubEnvironmentPath = String(process.env.GITHUB_ENV ?? "").trim();
if (process.env.CI !== "true" || !githubEnvironmentPath) {
  throw new Error("CI hosted environment generation is restricted to GitHub Actions.");
}

const databaseUrl = "postgresql://empire@127.0.0.1:5432/empire_e2e";
const secret = () => randomBytes(32).toString("base64url");
const values = {
  EMPIRE_DATABASE_URL: databaseUrl,
  GAMEPLAY_DATABASE_URL: databaseUrl,
  EMPIRE_TEST_DATABASE_URL: databaseUrl,
  GAMEPLAY_SLICE_SESSION_SECRET: secret(),
  GAMEPLAY_SLICE_SNAPSHOT_SECRET: secret(),
  EMPIRE_ADMIN_FINGERPRINT_SECRET: secret(),
  EMPIRE_ADMIN_SESSION_SECRET: secret(),
  EMPIRE_AUTH_THROTTLE_PEPPER: secret(),
  EMPIRE_ADMIN_BOOTSTRAP_PASSWORD: secret()
};

if (new Set(Object.values(values).slice(3)).size !== 6) {
  throw new Error("CI hosted environment generator produced a duplicate secret.");
}
await appendFile(
  githubEnvironmentPath,
  `${Object.entries(values).map(([name, value]) => `${name}=${value}`).join("\n")}\n`,
  { encoding: "utf8", mode: 0o600 }
);
console.log("Generated isolated CI database settings and six distinct ephemeral secrets without printing values.");
