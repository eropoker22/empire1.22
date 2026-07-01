import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const readText = (path) => readFileSync(resolve(root, path), "utf8").replace(/\r\n/g, "\n");

const publicOgImageUrl = "https://empstr.netlify.app/social/empire-streets-og.png";
const expectedDescription = "Ovládni město, které nemá pravidla.";

function readPngDimensions(path) {
  const buffer = readFileSync(resolve(root, path));
  const signature = buffer.subarray(0, 8).toString("hex");
  const chunkType = buffer.subarray(12, 16).toString("ascii");
  return {
    signature,
    chunkType,
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

describe("social preview metadata", () => {
  it("requires the OG asset in the Netlify publish output", () => {
    const buildScript = readText("scripts/build-netlify-client.mjs");

    expect(buildScript).toContain('await cp(resolve(rootDir, "public"), publishDir, { recursive: true });');
    expect(buildScript).toContain('"social/empire-streets-og.png"');
  });

  it("uses the Netlify public OG image on public entry pages", () => {
    const pages = [
      { path: "pages/login.html", canonical: "https://empstr.netlify.app/login.html" },
      { path: "pages/index.html", canonical: "https://empstr.netlify.app/" }
    ];

    for (const page of pages) {
      const html = readText(page.path);
      expect(html).toContain(`<link rel="canonical" href="${page.canonical}">`);
      expect(html).toContain(`<meta property="og:url" content="${page.canonical}">`);
      expect(html).toContain('<meta property="og:title" content="Empire Streets">');
      expect(html).toContain(`<meta property="og:description" content="${expectedDescription}">`);
      expect(html).toContain(`<meta property="og:image" content="${publicOgImageUrl}">`);
      expect(html).toContain(`<meta property="og:image:secure_url" content="${publicOgImageUrl}">`);
      expect(html).toContain('<meta property="og:image:width" content="1200">');
      expect(html).toContain('<meta property="og:image:height" content="630">');
      expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
      expect(html).toContain(`<meta name="twitter:image" content="${publicOgImageUrl}">`);
      expect(html).not.toContain("https://empirestreets.com/social/empire-streets-og.png");
    }
  });

  it("keeps the generated OG asset in the required 1200x630 PNG format", () => {
    const dimensions = readPngDimensions("public/social/empire-streets-og.png");

    expect(dimensions.signature).toBe("89504e470d0a1a0a");
    expect(dimensions.chunkType).toBe("IHDR");
    expect(dimensions.width).toBe(1200);
    expect(dimensions.height).toBe(630);
  });
});
