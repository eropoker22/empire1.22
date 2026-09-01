import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("rumor inbox CSS", () => {
  const css = readFileSync(resolve(process.cwd(), "page-assets/css/styles-action-results.css"), "utf8");

  it("keeps whole rumor text visible while the list itself scrolls", () => {
    expect(css).toContain("overflow-y: auto;");
    expect(css).toContain("scrollbar-width: none;");
    expect(css).not.toContain('.rumor-inbox-list[data-rumor-scrollable="true"] .rumor-inbox-message__text');
    expect(css).not.toContain("-webkit-line-clamp: 2;");
  });
});
