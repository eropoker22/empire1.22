import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { resolvePlaywrightTarget } from "./scripts/playwright-target-contract.mjs";

const PORT = Number(process.env.PLAYWRIGHT_PORT || 4174);
const HOST = "127.0.0.1";
const localBaseURL = `http://${HOST}:${PORT}`;
const target = resolvePlaywrightTarget(process.env, { baseURL: localBaseURL });
const baseURL = target.baseURL;
const healthURL = target.healthURL;
const nodeExecutable = JSON.stringify(process.execPath);
const viteExecutable = JSON.stringify(path.resolve("node_modules/vite/bin/vite.js"));
const webServerCommand = `${nodeExecutable} ${viteExecutable} --config vite.game.config.ts --host ${HOST} --port ${PORT}`;

process.env.PLAYWRIGHT_E2E_WEB_SERVER_COMMAND = webServerCommand;
process.env.PLAYWRIGHT_E2E_BASE_URL = baseURL;
process.env.PLAYWRIGHT_E2E_HEALTH_URL = healthURL;
process.env.PLAYWRIGHT_E2E_PORT = String(PORT);
process.env.PLAYWRIGHT_E2E_HOST = HOST;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 180_000,
  expect: {
    timeout: 5_000
  },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  failOnFlakyTests: Boolean(process.env.CI),
  retries: 0,
  workers: Number(process.env.PLAYWRIGHT_WORKERS || 1),
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    testIdAttribute: "data-testid"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  webServer: target.useManagedWebServer ? {
    command: webServerCommand,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000
  } : undefined
});
