import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "page-assets/js/login-live.js"), "utf8");
const entrySource = readFileSync(resolve(process.cwd(), "page-assets/js/login-entry.js"), "utf8");

describe("live login demo guest access", () => {
  it("does not expose a local demo entry on loopback", () => {
    expect(source).not.toContain("runtimeMode=local-demo");
    expect(source).not.toContain("SPUSTIT LOKÁLNÍ DEMO");
    expect(source).not.toContain("guestUsername");
    expect(source).not.toContain("guestGangName");
    expect(source).not.toContain("isLocalDemoAccessAvailable");
  });

  it("keeps live mode cards available but always enters the lobby on Free mode", () => {
    expect(source).toContain("bindModeCards()");
    expect(source).toContain('classList.toggle("auth-body--free"');
    expect(source).toContain('classList.toggle("auth-body--war"');
    expect(source).toContain("STORAGE_KEYS.activeAuthMode");
    expect(source).toContain('return "./lobby.html?mode=free";');
    expect(source).not.toContain("`./lobby.html?mode=${state.activeMode}`");
    expect(entrySource).toContain('import("./login-live.js?v=20260826-default-free-lobby")');
  });
});
