import { access, cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publishDir = resolve(rootDir, "client");
// `client/` is generated publish output. Only explicitly routed HTML pages are published.
const staticDirs = [
  "page-assets",
  "img",
  "packages/game-config/src/public",
  "packages/game-config/src/legacy-page",
  "packages/game-core/src/legacy-page"
];
const staticPageFiles = [
  "pages/login.html",
  "pages/lobby.html",
  "pages/faction.html",
  "pages/game.html"
];
const requiredPublishFiles = [
  ".htaccess",
  "admin.html",
  "pages/login.html",
  "social/empire-streets-og.png",
  "page-assets/js/login.js",
  "page-assets/js/client-assets/gameplay-slice-client.js",
  "page-assets/js/app/auth-flow.js",
  "page-assets/js/app/model/authority-state.js",
  "packages/game-config/src/public/public-server-registry.js",
  "packages/game-config/src/legacy-page/combat-config.js",
  "packages/game-config/src/legacy-page/economy-config.js",
  "packages/game-config/src/legacy-page/faction-config.js",
  "packages/game-config/src/legacy-page/gameplay-config.generated.js",
  "packages/game-core/src/legacy-page/combat-preview-rules.js",
  "packages/game-core/src/legacy-page/production-preview-rules.js",
  "packages/game-core/src/legacy-page/spy-preview-rules.js"
];

await rm(publishDir, { recursive: true, force: true });
await mkdir(publishDir, { recursive: true });
await cp(resolve(rootDir, "admin.html"), resolve(publishDir, "admin.html"));

for (const file of staticPageFiles) {
  const targetFile = resolve(publishDir, file);
  await mkdir(dirname(targetFile), { recursive: true });
  await cp(resolve(rootDir, file), targetFile);
}

for (const dir of staticDirs) {
  const targetDir = resolve(publishDir, dir);
  await mkdir(dirname(targetDir), { recursive: true });
  await cp(resolve(rootDir, dir), targetDir, { recursive: true });
}

try {
  await cp(resolve(rootDir, "public"), publishDir, { recursive: true });
} catch (error) {
  if (error?.code !== "ENOENT") {
    throw error;
  }
}

await writeFile(
  resolve(publishDir, "_redirects"),
  [
    "https://www.empirestreets.cz/* https://empirestreets.cz/:splat 301!",
    "http://www.empirestreets.cz/* https://empirestreets.cz/:splat 301!",
    "/api/servers /.netlify/functions/gameplay-slice/servers 200!",
    "/api/admin/* /.netlify/functions/gameplay-slice/admin/:splat 200!",
    "/api/account/* /.netlify/functions/gameplay-slice/account/:splat 200!",
    "/api/lobby/* /.netlify/functions/gameplay-slice/lobby/:splat 200!",
    "/api/gameplay-slice/* /.netlify/functions/gameplay-slice/:splat 200!",
    "/ /pages/login.html 200",
    "/login.html /pages/login.html 200",
    "/lobby.html /pages/lobby.html 200",
    "/game.html /pages/game.html 200",
    "/faction.html /pages/faction.html 200",
    ""
  ].join("\n"),
  "utf8"
);

await writeFile(
  resolve(publishDir, ".htaccess"),
  [
    "Options -MultiViews",
    "DirectoryIndex pages/login.html",
    "RewriteEngine On",
    "RewriteCond %{HTTP_HOST} ^www\\.empirestreets\\.cz$ [NC]",
    "RewriteRule ^(.*)$ https://empirestreets.cz/$1 [L,R=301]",
    "RewriteRule ^$ pages/login.html [L]",
    "RewriteRule ^login\\.html$ pages/login.html [L]",
    "RewriteRule ^lobby\\.html$ pages/lobby.html [L]",
    "RewriteRule ^game\\.html$ pages/game.html [L]",
    "RewriteRule ^faction\\.html$ pages/faction.html [L]",
    ""
  ].join("\n"),
  "utf8"
);

for (const file of requiredPublishFiles) {
  await access(resolve(publishDir, file));
}

for (const file of [["pages", "admin.html"].join("/"), ["admin", "index.html"].join("/")]) {
  try {
    await access(resolve(publishDir, file));
    throw new Error(`Forbidden duplicate admin build output: client/${file}`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

console.log(`Prepared Netlify publish directory: ${relative(rootDir, publishDir)}`);
