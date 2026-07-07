import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const readText = (path) => readFileSync(resolve(root, path), "utf8").replace(/\r\n/g, "\n");
const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const publicOgImageUrl = "https://empirestreets.cz/social/empire-streets-og.png";
const expectedTitle = "Empire Streets | Ovládni město";
const expectedDescription = "Cyberpunk gang strategie v ulicích bez pravidel. Buduj impérium, špehuj soupeře, ovládni districty a přežij policejní tlak.";
const descriptionMetaPattern = new RegExp(
  `<meta\\s+name="description"\\s+content="${escapeRegExp(expectedDescription)}"|<meta\\s+content="${escapeRegExp(expectedDescription)}"\\s+name="description"`,
  "s"
);

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

  it("uses the production public OG image on public entry pages", () => {
    const pages = [
      { path: "pages/login.html", canonical: "https://empirestreets.cz/" },
      { path: "pages/index.html", canonical: "https://empirestreets.cz/" },
      { path: "client/pages/login.html", canonical: "https://empirestreets.cz/" },
      { path: "client/pages/index.html", canonical: "https://empirestreets.cz/" }
    ];

    for (const page of pages) {
      const html = readText(page.path);
      expect(html).toContain('<html lang="cs" prefix="og: https://ogp.me/ns#">');
      expect(html).toContain(`<title>${expectedTitle}</title>`);
      expect(html).toContain(`<link rel="canonical" href="${page.canonical}">`);
      expect(html).toContain(`<meta property="og:url" content="${page.canonical}">`);
      expect(html).toContain(`<meta property="og:title" content="${expectedTitle}">`);
      expect(html).toContain(`<meta property="og:description" content="${expectedDescription}">`);
      expect(html).toMatch(descriptionMetaPattern);
      expect(html).toContain(`<meta itemprop="image" content="${publicOgImageUrl}">`);
      expect(html).toContain(`<meta property="og:image" content="${publicOgImageUrl}">`);
      expect(html).toContain(`<meta property="og:image:secure_url" content="${publicOgImageUrl}">`);
      expect(html).toContain(`<meta property="og:image:url" content="${publicOgImageUrl}">`);
      expect(html).toContain('<meta property="og:image:type" content="image/png">');
      expect(html).toContain('<meta property="og:image:width" content="1200">');
      expect(html).toContain('<meta property="og:image:height" content="630">');
      expect(html).toContain('<meta property="og:image:alt" content="Logo Empire Streets se zlatou korunou nad nočním městem.">');
      expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
      expect(html).toContain(`<meta name="twitter:title" content="${expectedTitle}">`);
      expect(html).toContain(`<meta name="twitter:description" content="${expectedDescription}">`);
      expect(html).toContain(`<meta name="twitter:image" content="${publicOgImageUrl}">`);
      expect(html).toContain('<meta name="twitter:image:alt" content="Logo Empire Streets se zlatou korunou nad nočním městem.">');
      expect(html).not.toContain("https://empirestreets.com/social/empire-streets-og.png");
      expect(html).not.toContain("https://empstr.netlify.app/social/empire-streets-og.png");
    }
  });

  it("keeps www links redirected to the canonical domain", () => {
    const netlifyConfig = readText("netlify.toml");
    const buildScript = readText("scripts/build-netlify-client.mjs");
    const redirects = readText("client/_redirects");
    const htaccess = readText("client/.htaccess");

    expect(netlifyConfig).toContain('from = "https://www.empirestreets.cz/*"');
    expect(netlifyConfig).toContain('to = "https://empirestreets.cz/:splat"');
    expect(buildScript).toContain("https://www.empirestreets.cz/* https://empirestreets.cz/:splat 301!");
    expect(redirects).toContain("https://www.empirestreets.cz/* https://empirestreets.cz/:splat 301!");
    expect(htaccess).toContain("RewriteCond %{HTTP_HOST} ^www\\.empirestreets\\.cz$ [NC]");
    expect(htaccess).toContain("RewriteRule ^(.*)$ https://empirestreets.cz/$1 [L,R=301]");
  });

  it("keeps the generated OG assets in the required 1200x630 PNG format", () => {
    const imagePaths = [
      "public/social/empire-streets-og.png",
      "client/social/empire-streets-og.png"
    ];

    for (const imagePath of imagePaths) {
      const dimensions = readPngDimensions(imagePath);

      expect(dimensions.signature).toBe("89504e470d0a1a0a");
      expect(dimensions.chunkType).toBe("IHDR");
      expect(dimensions.width).toBe(1200);
      expect(dimensions.height).toBe(630);
    }
  });
});
