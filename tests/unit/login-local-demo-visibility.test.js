import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");

describe("public login local demo visibility", () => {
  it("removes demo entry points from login and lobby", () => {
    const loginPage = readFileSync(resolve(root, "pages/login.html"), "utf8");
    const lobbyPage = readFileSync(resolve(root, "pages/lobby.html"), "utf8");
    const liveLogin = readFileSync(resolve(root, "page-assets/js/login-live.js"), "utf8");
    const lobby = readFileSync(resolve(root, "page-assets/js/lobby-live.js"), "utf8");

    expect(loginPage).not.toContain("guest-access");
    expect(loginPage).not.toContain("guest-login-button");
    expect(lobbyPage).not.toContain("data-local-demo-access");
    expect(lobbyPage).not.toContain("data-open-local-demo");
    expect(liveLogin).not.toContain("runtimeMode=local-demo");
    expect(lobby).not.toContain("runtimeMode=local-demo");
  });

  it("pins public player entrypoints to live mode", () => {
    for (const path of [
      "page-assets/js/login-entry.js",
      "page-assets/js/lobby-entry.js",
      "page-assets/js/faction-entry.js"
    ]) {
      const source = readFileSync(resolve(root, path), "utf8");
      expect(source).toContain("localDemoEnabled: false");
      expect(source).not.toMatch(/import\(["']\.\/(?:login|lobby|faction|app-demo)\.js/u);
    }
  });

  it("keeps the game demo import behind the strict E2E flag-pair gate", () => {
    const source = readFileSync(resolve(root, "page-assets/js/app-entry.js"), "utf8");
    expect(source).toContain("isE2eLocalDemoEntryEnabled()");
    expect(source).toContain("window.__EMPIRE_GAMEPLAY_EXECUTION_MODE__ = executionMode");
    expect(source).toContain("executionMode === CLIENT_EXECUTION_MODES.localDemo");
    expect(source).toMatch(/import\(["']\.\/app-demo\.js\?v=20260731-e2e-parity-only["']\)/u);
    expect(source).toMatch(/import\(["']\.\/app\.js\?v=[a-z0-9-]+["']\)/u);
  });
});
