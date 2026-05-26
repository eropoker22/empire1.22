import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PLAYWRIGHT_PORT || 4174);
const HOST = "127.0.0.1";
const baseURL = `http://${HOST}:${PORT}`;
const healthURL = `${baseURL}/pages/login.html`;
const nodeExecutable = JSON.stringify(process.execPath);

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 180_000,
  expect: {
    timeout: 5_000
  },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
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
    command: `${nodeExecutable} scripts/run-local-bin.mjs vite/bin/vite.js --host ${HOST} --port ${PORT}`,
    url: healthURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});
