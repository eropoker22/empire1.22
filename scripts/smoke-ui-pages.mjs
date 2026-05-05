import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const pages = [
  "pages/index.html",
  "pages/login.html",
  "pages/lobby.html",
  "pages/faction.html",
  "pages/game.html",
  "pages/admin.html"
];
const violations = [];

const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));
const normalizeAssetPath = (pagePath, assetPath) => {
  if (
    assetPath.startsWith("http:") ||
    assetPath.startsWith("https:") ||
    assetPath.startsWith("#") ||
    assetPath.startsWith("mailto:")
  ) {
    return null;
  }

  return path
    .normalize(path.join(path.dirname(pagePath), assetPath))
    .replace(/\\/g, "/");
};

for (const pagePath of pages) {
  if (!exists(pagePath)) {
    violations.push(`${pagePath} is missing`);
    continue;
  }

  const html = read(pagePath);

  if (!html.includes("<main")) {
    violations.push(`${pagePath} does not define a main UI root`);
  }

  for (const match of html.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)) {
    const assetPath = normalizeAssetPath(pagePath, match[1]);

    if (!assetPath || assetPath.endsWith(".html")) {
      continue;
    }

    if (!exists(assetPath)) {
      violations.push(`${pagePath} references missing asset ${match[1]} (${assetPath})`);
    }
  }
}

const gameHtml = read("pages/game.html");
if (!gameHtml.includes("data-page=\"game\"")) {
  violations.push("pages/game.html is missing the game page marker");
}

const gameMapAnchors = [
  "id=\"game-map-stage\"",
  "id=\"game-map-mount\"",
  "data-map-viewport",
  "data-map-canvas",
  "data-district-canvas",
  "data-district-tooltip",
  "data-district-popup",
  "data-district-popup-title",
  "data-district-popup-owner",
  "data-district-popup-buildings-list",
  "data-buildings-popup",
  "data-buildings-popup-detail"
];
for (const anchor of gameMapAnchors) {
  if (!gameHtml.includes(anchor)) {
    violations.push(`pages/game.html is missing map anchor ${anchor}`);
  }
}

const adminHtml = read("pages/admin.html");
if (!adminHtml.includes("type=\"module\" src=\"../page-assets/js/admin-assets/admin-slice-demo.js\"")) {
  violations.push("pages/admin.html must load the admin slice bundle as a module script");
}

const netlifyConfig = read("netlify.toml");
if (!netlifyConfig.includes('from = "/lobby.html"') || !netlifyConfig.includes('to = "/pages/lobby.html"')) {
  violations.push("netlify.toml must route /lobby.html to /pages/lobby.html for the guest login flow");
}

const netlifyPublishScript = read("scripts/build-netlify-client.mjs");
if (!netlifyPublishScript.includes("/lobby.html /pages/lobby.html 200")) {
  violations.push("scripts/build-netlify-client.mjs must emit a /lobby.html redirect");
}
if (
  !netlifyPublishScript.includes("packages/game-config/src/legacy-page")
  || !netlifyPublishScript.includes("packages/game-core/src/legacy-page")
) {
  violations.push("scripts/build-netlify-client.mjs must publish legacy package modules used by browser ESM imports");
}

if (violations.length > 0) {
  console.error("UI smoke violations detected:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("UI page smoke checks passed.");
