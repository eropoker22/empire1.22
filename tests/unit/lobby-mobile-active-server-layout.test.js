import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("mobile lobby active server layout", () => {
  it("keeps the continue button visible above compact server mode tabs", () => {
    const stylesheet = readFileSync("page-assets/css/lobby.css", "utf8");
    const mobile = stylesheet.slice(stylesheet.lastIndexOf("@media (max-width: 640px)"));

    expect(mobile).toContain(".lobby-active-server-card");
    expect(mobile).toContain("grid-template-columns: repeat(3, minmax(0, 1fr));");
    expect(mobile).toContain(".lobby-active-server-card .lobby-primary-cta");
    expect(mobile).toContain("min-height: 40px;");
    expect(mobile).toContain(".auth-mode-tab");
    expect(mobile).toContain("min-height: 34px;");
  });
});
