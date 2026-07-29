import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");

describe("public login local demo visibility", () => {
  it("keeps hidden guest access out of layout", () => {
    const css = readFileSync(resolve(root, "page-assets/css/login.css"), "utf8");

    expect(css).toMatch(/\.guest-access\[hidden\]\s*\{\s*display:\s*none\s*!important;\s*\}/u);
  });

  it("reveals demo entry points only behind local authority gates", () => {
    const liveLogin = readFileSync(resolve(root, "page-assets/js/login-live.js"), "utf8");
    const demoLogin = readFileSync(resolve(root, "page-assets/js/login.js"), "utf8");
    const lobby = readFileSync(resolve(root, "page-assets/js/lobby-live.js"), "utf8");

    expect(liveLogin).toContain("isLocalDemoAccessAvailable()");
    expect(liveLogin).toContain("guestAccess.hidden = !localDemoAvailable");
    expect(demoLogin).toContain("isExplicitLocalDemoEnabled()");
    expect(demoLogin).toContain("guestAccess.hidden = !localDemoEnabled");
    expect(lobby).toContain("isLocalDemoAccessAvailable()");
    expect(lobby).toContain("demoAccess.hidden = !localDemoAvailable");
  });
});
