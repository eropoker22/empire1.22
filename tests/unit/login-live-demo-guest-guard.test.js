import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "page-assets/js/login-live.js"), "utf8");

describe("live login demo guest access", () => {
  it("exposes the explicit demo link only on loopback hosts", () => {
    expect(source).toContain("isLocalDemoAccessAvailable");
    expect(source).toContain("runtimeMode=local-demo&mode=${state.activeMode}");
    expect(source).toContain('guestButton.textContent = "SPUSTIT LOKÁLNÍ DEMO"');
    expect(source).toContain("guestAccess.hidden = true");
    expect(source).toContain("guestAccess.hidden = false");
  });

  it("keeps the live mode cards and lobby destination synchronized", () => {
    expect(source).toContain("bindModeCards()");
    expect(source).toContain('classList.toggle("auth-body--free"');
    expect(source).toContain('classList.toggle("auth-body--war"');
    expect(source).toContain("STORAGE_KEYS.activeAuthMode");
    expect(source).toContain("`./lobby.html?mode=${state.activeMode}`");
  });
});
