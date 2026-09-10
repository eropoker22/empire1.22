import { defineConfig, devices } from "@playwright/test";
import baseConfig from "./playwright.config";

export default defineConfig({
  ...baseConfig,
  testMatch: /heat-reduction-panel\.spec\.js$/,
  projects: [
    { name: "mobile-chromium", use: { ...devices["Pixel 7"], browserName: "chromium" } },
    { name: "mobile-webkit", use: { ...devices["iPhone 13"], browserName: "webkit" } }
  ]
});
