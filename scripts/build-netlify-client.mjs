import { access, cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publishDir = resolve(rootDir, "client");
// `client/` is generated publish output. Canonical source stays in root `pages/`,
// `page-assets/`, `img/`, and the explicit legacy browser compatibility modules.
const staticDirs = [
  "pages",
  "page-assets",
  "img",
  "packages/game-config/src/public",
  "packages/game-config/src/legacy-page",
  "packages/game-core/src/legacy-page"
];
const requiredPublishFiles = [
  ".htaccess",
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
  "packages/game-core/src/legacy-page/combat-preview-rules.js",
  "packages/game-core/src/legacy-page/production-preview-rules.js",
  "packages/game-core/src/legacy-page/spy-preview-rules.js"
];

await rm(publishDir, { recursive: true, force: true });
await mkdir(publishDir, { recursive: true });

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
    "/ /pages/login.html 200",
    "/login.html /pages/login.html 200",
    "/lobby.html /pages/lobby.html 200",
    "/game.html /pages/game.html 200",
    "/admin /pages/admin.html 200",
    "/admin.html /pages/admin.html 200",
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
    "RewriteRule ^$ pages/login.html [L]",
    "RewriteRule ^login\\.html$ pages/login.html [L]",
    "RewriteRule ^lobby\\.html$ pages/lobby.html [L]",
    "RewriteRule ^game\\.html$ pages/game.html [L]",
    "RewriteRule ^admin/?$ pages/admin.html [L]",
    "RewriteRule ^admin\\.html$ pages/admin.html [L]",
    "RewriteRule ^faction\\.html$ pages/faction.html [L]",
    ""
  ].join("\n"),
  "utf8"
);

for (const file of requiredPublishFiles) {
  await access(resolve(publishDir, file));
}

console.log(`Prepared Netlify publish directory: ${relative(rootDir, publishDir)}`);
