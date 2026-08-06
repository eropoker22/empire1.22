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

  it("keeps server slots and registration status compact below an active membership", () => {
    const stylesheet = readFileSync("page-assets/css/lobby.css", "utf8");
    const compactMobile = stylesheet.slice(stylesheet.lastIndexOf(
      "/* Mobile active-membership server slots and registration summary stay compact. */"
    ));

    expect(compactMobile).toContain("grid-template-columns: minmax(0, 1fr) 88px;");
    expect(compactMobile).toContain("min-height: 64px;");
    expect(compactMobile).toContain(".auth-server-card__schedule");
    expect(compactMobile).toContain("display: none;");
    expect(compactMobile).toContain("body.servers-page .lobby-registration-status");
    expect(compactMobile).toContain("grid-template-columns: minmax(0, 1fr) auto;");
    expect(compactMobile).toContain("padding: 7px 9px;");
  });
});
