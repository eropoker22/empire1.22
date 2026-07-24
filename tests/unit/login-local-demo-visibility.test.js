import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");

describe("public login local demo visibility", () => {
  it("keeps hidden guest access out of layout", () => {
    const css = readFileSync(resolve(root, "page-assets/css/login.css"), "utf8");

    expect(css).toMatch(/\.guest-access\[hidden\]\s*\{\s*display:\s*none\s*!important;\s*\}/u);
  });
});
