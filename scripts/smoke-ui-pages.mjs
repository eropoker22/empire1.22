import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const pages = [
  "pages/login.html",
  "pages/lobby.html",
  "pages/faction.html",
  "pages/game.html",
  "admin.html"
];
const violations = [];
const forbiddenLegacyPages = [
  "pages/index.html",
  "pages/404.html",
  "pages/ui-kit.html",
  "server-select.html",
  "server-select.js",
  "server-select.css"
];

const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

for (const legacyPage of forbiddenLegacyPages) {
  if (exists(legacyPage)) violations.push(`${legacyPage} is an obsolete, unrouted production artifact`);
}
const normalizeAssetPath = (pagePath, assetPath) => {
  const rawAssetPath = String(assetPath || "");
  if (
    rawAssetPath.startsWith("http:") ||
    rawAssetPath.startsWith("https:") ||
    rawAssetPath.startsWith("#") ||
    rawAssetPath.startsWith("mailto:")
  ) {
    return null;
  }
  const cleanAssetPath = rawAssetPath.split(/[?#]/u)[0];
  if (!cleanAssetPath) {
    return null;
  }

  return path
    .normalize(path.join(path.dirname(pagePath), cleanAssetPath))
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

const adminHtml = read("admin.html");
if (!adminHtml.includes("src=\"./page-assets/js/admin-assets/admin-app.js\"")) {
  violations.push("admin.html must load the admin monitoring app bundle");
}
if (exists("pages/admin.html")) {
  violations.push("pages/admin.html must not exist; admin.html is the only source entrypoint");
}
for (const forbiddenText of ["admin-dashboard--mock", "data-static-fallback", "Neon Boss", "Chrome Saint"]) {
  if (adminHtml.includes(forbiddenText)) {
    violations.push(`admin.html contains forbidden dashboard fallback text: ${forbiddenText}`);
  }
}

const netlifyConfig = read("netlify.toml");
if (!netlifyConfig.includes('from = "/lobby.html"') || !netlifyConfig.includes('to = "/pages/lobby.html"')) {
  violations.push("netlify.toml must route /lobby.html to /pages/lobby.html for the guest login flow");
}
if (!netlifyConfig.includes('from = "/api/account/*"') || !netlifyConfig.includes('to = "/.netlify/functions/gameplay-slice/account/:splat"')) {
  violations.push("netlify.toml must route account API requests to the gameplay-slice function");
}
if (!netlifyConfig.includes('from = "/api/lobby/*"') || !netlifyConfig.includes('to = "/.netlify/functions/gameplay-slice/lobby/:splat"')) {
  violations.push("netlify.toml must route lobby API requests to the gameplay-slice function");
}
if (!netlifyConfig.includes('from = "/api/servers"') || !netlifyConfig.includes('to = "/.netlify/functions/gameplay-slice/servers"')) {
  violations.push("netlify.toml must route the public server registry to the gameplay-slice function");
}
if (!netlifyConfig.includes('from = "/api/admin/*"') || !netlifyConfig.includes('to = "/.netlify/functions/gameplay-slice/admin/:splat"')) {
  violations.push("netlify.toml must route admin API requests to the gameplay-slice function");
}
if (!netlifyConfig.includes('from = "/api/gameplay-slice/*"') || !netlifyConfig.includes('to = "/.netlify/functions/gameplay-slice/:splat"')) {
  violations.push("netlify.toml must route gameplay API requests to the gameplay-slice function");
}
const globalSecurityHeaders = netlifyConfig.match(
  /\[\[headers\]\]\s*\r?\n\s*for = "\/\*"\s*\r?\n\s*\[headers\.values\]([\s\S]*?)(?=\r?\n\[\[|$)/u
);
if (!globalSecurityHeaders) {
  violations.push("netlify.toml must define global security headers for static pages");
} else {
  for (const [headerName, headerValue] of [
    ["X-Content-Type-Options", "nosniff"],
    ["X-Frame-Options", "DENY"],
    ["Referrer-Policy", "strict-origin-when-cross-origin"],
    ["Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()"]
  ]) {
    if (!globalSecurityHeaders[1].includes(`${headerName} = "${headerValue}"`)) {
      violations.push(`netlify.toml must set ${headerName} to ${headerValue}`);
    }
  }
}

const netlifyPublishScript = read("scripts/build-netlify-client.mjs");
if (!netlifyPublishScript.includes("/lobby.html /pages/lobby.html 200")) {
  violations.push("scripts/build-netlify-client.mjs must emit a /lobby.html redirect");
}
if (!netlifyPublishScript.includes("/api/account/* /.netlify/functions/gameplay-slice/account/:splat 200!")) {
  violations.push("scripts/build-netlify-client.mjs must emit the account API redirect");
}
if (!netlifyPublishScript.includes("/api/lobby/* /.netlify/functions/gameplay-slice/lobby/:splat 200!")) {
  violations.push("scripts/build-netlify-client.mjs must emit the lobby API redirect");
}
if (!netlifyPublishScript.includes("/api/servers /.netlify/functions/gameplay-slice/servers 200!")) {
  violations.push("scripts/build-netlify-client.mjs must emit the public server registry redirect");
}
if (!netlifyPublishScript.includes("/api/admin/* /.netlify/functions/gameplay-slice/admin/:splat 200!")) {
  violations.push("scripts/build-netlify-client.mjs must emit the admin API redirect");
}
if (!netlifyPublishScript.includes("/api/gameplay-slice/* /.netlify/functions/gameplay-slice/:splat 200!")) {
  violations.push("scripts/build-netlify-client.mjs must emit the gameplay API redirect");
}
if (
  !netlifyPublishScript.includes("packages/game-config/src/legacy-page")
  || !netlifyPublishScript.includes("packages/game-config/src/public/public-server-registry.js")
  || !netlifyPublishScript.includes("packages/game-core/src/legacy-page")
) {
  violations.push("scripts/build-netlify-client.mjs must publish browser ESM package modules used by static pages");
}
if (/from\s*=\s*["']\/admin\/?["']/u.test(netlifyConfig)) {
  violations.push("netlify.toml must not publish /admin or /admin/");
}
if (netlifyPublishScript.includes("pages/admin.html") || netlifyPublishScript.includes("/admin /")) {
  violations.push("scripts/build-netlify-client.mjs must publish only root admin.html");
}

if (violations.length > 0) {
  console.error("UI smoke violations detected:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("Legacy/static UI page smoke checks passed. This does not verify the server-authoritative gameplay slice.");
