import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "page-assets/js/login-live.js"), "utf8");

describe("live login demo guest access", () => {
  it("exposes the explicit demo link only on loopback hosts", () => {
    expect(source).toContain("isLocalDemoAccessAvailable");
    expect(source).toContain('location.assign("./login.html?runtimeMode=local-demo")');
    expect(source).toContain('guestButton.textContent = "LOKÁLNÍ UI DEMO"');
    expect(source).toContain("guestAccess.hidden = true");
    expect(source).toContain("guestAccess.hidden = false");
  });
});
