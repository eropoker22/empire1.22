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

  it("does not render gameplay recommendations above the map", () => {
    expect(source).not.toContain("LIVENESS_LABELS");
    expect(source).not.toContain("Vyšpehuj sousední");
    expect(source).not.toContain("Prozkoumej nebo obsaď sousední");
    expect(source).toContain("dataset.operationalRecovery");
    expect(source).toContain("NOUZOVÁ OBNOVA");
  });
});
