import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PLAYWRIGHT_PORT || 4174);
const HOST = "127.0.0.1";
const baseURL = `http://${HOST}:${PORT}`;
const healthURL = `${baseURL}/api/servers`;
const nodeExecutable = JSON.stringify(process.execPath);
const webServerCommand = `${nodeExecutable} scripts/playwright-vite-web-server.mjs --config vite.game.config.ts --host ${HOST} --port ${PORT}`;

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
  retries: process.env.CI ? 1 : 0,
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
  webServer: {
    command: webServerCommand,
    url: healthURL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000
  }
});
