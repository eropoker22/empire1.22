import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "page-assets/js/login-live.js"), "utf8");

describe("live login demo guest guard", () => {
  it("keeps the host shortcut limited to the local demo switch", () => {
    expect(source).toContain("isLocalDemoAccessAvailable");
    expect(source).toContain('location.assign("./login.html?runtimeMode=local-demo")');
    expect(source).toContain("guestAccess.hidden = true");
  });
});
