import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "page-assets/js/login-live.js"), "utf8");

describe("live login demo guest access", () => {
  it("offers the local demo entry only through the loopback gate", () => {
    expect(source).toContain("runtimeMode=local-demo&mode=${state.activeMode}&autoStartLocalDemo=1");
    expect(source).toContain('guestButton.textContent = "SPUSTIT LOKÁLNÍ DEMO"');
    expect(source).toContain("STORAGE_KEYS.guestUsername");
    expect(source).toContain("STORAGE_KEYS.guestGangName");
    expect(source).toContain("isLocalDemoAccessAvailable()");
    expect(source).toContain("guestAccess.hidden = !localDemoAvailable");
    expect(source).toContain("if (!localDemoAvailable) return");
  });

  it("keeps the live mode cards and lobby destination synchronized", () => {
    expect(source).toContain("bindModeCards()");
    expect(source).toContain('classList.toggle("auth-body--free"');
    expect(source).toContain('classList.toggle("auth-body--war"');
    expect(source).toContain("STORAGE_KEYS.activeAuthMode");
    expect(source).toContain("`./lobby.html?mode=${state.activeMode}`");
  });
});
