import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { renderSidePanelShell } from "../../../apps/client/src/ui";

const stylesPath = resolve(process.cwd(), "page-assets/css/styles-gameplay-slice-client.css");
const readStyles = () => readFileSync(stylesPath, "utf8");

describe("gameplay slice mobile sheet", () => {
  it("renderuje side panel s mobile-sheet třídami", () => {
    const html = renderSidePanelShell({
      activePanel: "district",
      contentHtml: "<p>District content</p>"
    });

    expect(html).toContain('<aside class="side-panel-shell mobile-sheet" data-panel="district">');
    expect(html).toContain('<div class="mobile-sheet__body">');
    expect(html).toContain("<p>District content</p>");
  });

  it("vrstva backdropu má obecné css třídy", () => {
    const styles = readStyles();

    expect(styles).toContain(".overlay-root");
    expect(styles).toContain(".backdrop");
    expect(styles).toContain(".gameplay-slice-backdrop");
  });

  it("definuje mobilní bottom sheet: fixed, omezenou výšku, vlastní scrollovatelný body a safe-area", () => {
    const styles = readStyles();

    expect(styles).toMatch(
      /\.gameplay-slice-client__panel\s+\.mobile-sheet\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?left:\s*0;[\s\S]*?right:\s*0;[\s\S]*?bottom:\s*0;[\s\S]*?width:\s*100%;[\s\S]*?max-height:\s*82dvh;[\s\S]*?overscroll-behavior:\s*contain;/
    );
    expect(
      styles
    ).toMatch(
      /\.gameplay-slice-client__panel\s+\.mobile-sheet\s+\.mobile-sheet__body\s*\{[\s\S]*?overflow-y:\s*auto;[\s\S]*?overscroll-behavior:\s*contain;[\s\S]*?\}/
    );
    expect(styles).toContain("padding-bottom: env(safe-area-inset-bottom);");
  });
});
