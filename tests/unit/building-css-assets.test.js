import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const buildingCssFiles = [
  "page-assets/css/styles-building-modals.css",
  "page-assets/css/styles-mobile-fixes.css"
];

describe("building CSS assets", () => {
  it.each(buildingCssFiles)("keeps every referenced building image available in %s", (relativeCssPath) => {
    const absoluteCssPath = resolve(root, relativeCssPath);
    const css = readFileSync(absoluteCssPath, "utf8");
    const referencedImages = Array.from(
      css.matchAll(/url\(\s*["']?(\.\.\/\.\.\/img\/budovy\/[^)"']+)["']?\s*\)/gu),
      (match) => match[1]
    );

    expect(referencedImages.length).toBeGreaterThan(0);
    for (const referencedImage of referencedImages) {
      expect(existsSync(resolve(dirname(absoluteCssPath), referencedImage)), referencedImage).toBe(true);
    }
  });
});
