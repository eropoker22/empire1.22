import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("page-assets/js/app/closed-alpha-ux-runtime.js", "utf8");

describe("closed alpha UX runtime", () => {
  it("does not add visible Street News category filters", () => {
    expect(source).not.toContain("data-news-filter");
    expect(source).not.toContain("SOUKROMÉ");
    expect(source).not.toContain("VEŘEJNÉ");
    expect(source).not.toContain("EKONOMIKA");
    expect(source).toContain("document.querySelectorAll(\"[data-street-news-filters]\").forEach");
  });
});
