import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";

process.loadEnvFile?.(".env.local");

const HOST = "127.0.0.1";
const OPEN_PORT = 5176;
const CLOSED_PORT = 5177;
const openOrigin = `http://${HOST}:${OPEN_PORT}`;
const closedOrigin = `http://${HOST}:${CLOSED_PORT}`;
const suffix = randomBytes(6).toString("hex");
const username = `Switch${suffix}`;
const gangName = `Switch Crew ${suffix}`;
const password = randomBytes(24).toString("base64url");
let server = null;

try {
  server = startServer(OPEN_PORT, openOrigin, true);
  const openPolicy = await waitForPolicy(openOrigin, true, server);
  const registration = await fetch(`${openOrigin}/api/account/register`, {
    method: "POST",
    headers: {
      origin: openOrigin,
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.120"
    },
    body: JSON.stringify({
      username,
      gangName,
      dateOfBirth: "1990-01-01",
      password,
      passwordConfirmation: password,
      termsAccepted: true,
      termsVersion: openPolicy.termsVersion
    })
  });
  if (registration.status !== 201) throw new Error("Kill-switch fixture account registration failed.");
  const cookie = String(registration.headers.get("set-cookie") ?? "").split(";")[0];
  if (!cookie.includes("=")) throw new Error("Kill-switch fixture account cookie is missing.");

  stopServer(server);
  server = startServer(CLOSED_PORT, closedOrigin, false);
  await waitForPolicy(closedOrigin, false, server);

  const restored = await fetch(`${closedOrigin}/api/account/session`, {
    headers: { cookie },
    cache: "no-store"
  });
  if (restored.status !== 200) throw new Error("Existing account session did not survive registration shutdown.");

  const closed = await fetch(`${closedOrigin}/api/account/register`, {
    method: "POST",
    headers: {
      origin: closedOrigin,
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.121"
    },
    body: "{}"
  });
  if (closed.status !== 403) throw new Error("Registration kill switch did not reject direct POST.");

  const result = spawnSync(process.execPath, [
    "scripts/run-local-bin.mjs",
    "playwright/cli.js",
    "test",
    "tests/e2e/account-registration-kill-switch-live.spec.js"
  ], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      EMPIRE_ACCOUNT_REGISTRATION_KILL_SWITCH_E2E: "1",
      EMPIRE_KILL_SWITCH_USERNAME: username,
      EMPIRE_KILL_SWITCH_PASSWORD: password,
      PLAYWRIGHT_PORT: String(CLOSED_PORT),
      PLAYWRIGHT_SKIP_WEB_SERVER: "1"
    },
    stdio: "inherit",
    windowsHide: true
  });
  if (result.status !== 0) throw new Error("Registration kill-switch browser acceptance failed.");
  console.log("Registration kill switch acceptance passed without exposing credentials.");
} finally {
  stopServer(server);
}
process.exit(0);

function startServer(port, publicOrigin, registrationEnabled) {
  return spawn(process.execPath, [
    "node_modules/vite/bin/vite.js",
    "--config",
    "vite.game.config.ts",
    "--host",
    HOST,
    "--port",
    String(port)
  ], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "production",
      EMPIRE_PUBLIC_ORIGIN: publicOrigin,
      EMPIRE_ALLOWED_ORIGINS: publicOrigin,
      EMPIRE_CLOSED_ALPHA_REGISTRATION_ENABLED: String(registrationEnabled)
    },
    stdio: "ignore",
    windowsHide: true
  });
}

async function waitForPolicy(publicOrigin, expectedEnabled, child) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error("Kill-switch Vite server exited before readiness.");
    try {
      const response = await fetch(`${publicOrigin}/api/account/registration-policy`, { cache: "no-store" });
      const payload = await response.json();
      if (response.ok && payload?.data?.registrationEnabled === expectedEnabled) return payload.data;
    } catch (_error) {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Kill-switch Vite server did not reach the expected registration state.");
}

function stopServer(child) {
  if (!child?.pid || child.exitCode !== null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
  } else {
    child.kill("SIGTERM");
  }
}
