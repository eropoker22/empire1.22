import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path) => readFileSync(path, "utf8");

describe("mobile overlay visual guards", () => {
  it("keeps all faction colors visible in a compact eight-column phone palette", () => {
    const css = read("page-assets/css/styles-auth-faction.css");

    expect(css).toContain("flex-wrap: wrap !important;");
    expect(css).toContain("justify-content: center !important;");
    expect(css).toContain("flex: 0 0 calc((100% - 42px) / 8) !important;");
    expect(css).toContain("max-height: none !important;");
    expect(css).toContain("min-height: 30px !important;");
  });

  it("hides background building shortcuts and preserves large modal close targets", () => {
    const css = read("page-assets/css/styles.css");

    expect(css).toContain("game-modal-scroll-locked #building-shortcut-grid");
    expect(css).toContain("#bounty-modal:not(.hidden):not([hidden])");
    expect(css).toContain(".elimination-ai-panel__close");
    expect(css).toContain("min-width: 42px !important;");
    expect(css).toContain("touch-action: manipulation !important;");
  });
});
