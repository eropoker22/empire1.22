import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const productionRoots = [
  "page-assets/js/login-live.js",
  "page-assets/js/lobby-live.js",
  "page-assets/js/faction-live.js",
  "page-assets/js/app.js",
  "page-assets/js/app/mobile-performance-runtime.js",
  "page-assets/js/app/final-lockdown-popup-runtime.js",
  "page-assets/js/app/city-events-runtime.js",
  "page-assets/js/app/alliance-runtime.js",
  "page-assets/js/app/bounty-runtime.js",
  "page-assets/js/app/faction-actions-runtime.js",
  "page-assets/js/app/game-about-modal-runtime.js",
  "page-assets/js/app/boost-runtime.js",
  "page-assets/js/app/game-window-restore-runtime.js",
  "page-assets/js/app/mobile-layout-runtime.js",
  "page-assets/js/app/game-admin-slice-launcher.js",
  "page-assets/js/app/closed-alpha-ux-runtime.js",
  "page-assets/js/admin-assets/admin-app.js"
];
const productionPages = [
  "admin.html",
  "pages/login.html",
  "pages/lobby.html",
  "pages/faction.html",
  "pages/game.html"
];
const entrypoints = [
  ["page-assets/js/login-entry.js", "login-live.js", "login.js"],
  ["page-assets/js/lobby-entry.js", "lobby-live.js", "lobby.js"],
  ["page-assets/js/faction-entry.js", "faction-live.js", "faction.js"],
  ["page-assets/js/app-entry.js", "app.js", "app-demo.js"]
];
const forbiddenGraphFragments = [
  "/dev-fixtures/",
  "/onboarding/demoscenarios.js",
  "/login.js",
  "/lobby.js",
  "/faction.js",
  "/app-demo.js"
];
const forbiddenSeedText = [
  "Raven Syndicate",
  "Host-5470",
  "Night Vulture",
  "WAR-01",
  "8.47M"
];
const staticImportPattern = /(?:^|\n)\s*(?:import|export)\s+(?:[^'"\n]*?\s+from\s+)?["']([^"']+)["']/gu;
const errors = [];
const visited = new Set();

for (const rootFile of productionRoots) walkStaticImports(resolve(root, rootFile), []);

for (const [entrypoint, liveModule, demoModule] of entrypoints) {
  const source = readFileSync(resolve(root, entrypoint), "utf8");
  if (!source.includes("resolveClientEntryExecutionMode") || !source.includes(liveModule) || !source.includes(demoModule)) {
    errors.push(`${entrypoint}: entrypoint nemá explicitní authority volbu mezi live a demo modulem.`);
  }
  if (!source.includes("CLIENT_EXECUTION_MODES.localDemo")) {
    errors.push(`${entrypoint}: demo import není chráněný explicitním local-demo režimem.`);
  }
}

for (const page of productionPages) {
  const source = readFileSync(resolve(root, page), "utf8");
  for (const seed of forbiddenSeedText) {
    if (source.includes(seed)) errors.push(`${page}: produkční HTML obsahuje seed hodnotu ${JSON.stringify(seed)}.`);
  }
}

if (errors.length) {
  console.error("Production fixture boundary selhal:\n");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(`Production fixture boundary OK (${visited.size} live modulů, ${productionPages.length} stránek).`);
}

function walkStaticImports(filePath, chain) {
  const normalizedFile = normalizePath(filePath);
  if (visited.has(normalizedFile)) return;
  visited.add(normalizedFile);
  const source = readFileSync(filePath, "utf8");

  for (const seed of forbiddenSeedText) {
    if (source.includes(seed)) {
      errors.push(`${relative(root, filePath)}: live graf obsahuje seed hodnotu ${JSON.stringify(seed)}.`);
    }
  }

  for (const specifier of source.matchAll(staticImportPattern)) {
    const imported = specifier[1].split("?")[0];
    if (!imported.startsWith(".")) continue;
    const resolvedImport = resolveImport(dirname(filePath), imported);
    if (!resolvedImport) continue;
    const normalizedImport = normalizePath(resolvedImport).toLowerCase();
    const forbidden = forbiddenGraphFragments.find((fragment) => normalizedImport.endsWith(fragment) || normalizedImport.includes(fragment));
    if (forbidden) {
      const importChain = [...chain, relative(root, filePath), relative(root, resolvedImport)].join(" -> ");
      errors.push(`Zakázaný produkční import (${forbidden}): ${importChain}`);
      continue;
    }
    walkStaticImports(resolvedImport, [...chain, relative(root, filePath)]);
  }
}

function resolveImport(baseDir, specifier) {
  const candidate = resolve(baseDir, specifier);
  const candidates = extname(candidate)
    ? [candidate]
    : [candidate, `${candidate}.js`, `${candidate}.mjs`, `${candidate}.ts`, resolve(candidate, "index.js"), resolve(candidate, "index.ts")];
  return candidates.find((entry) => existsSync(entry)) || null;
}

function normalizePath(filePath) {
  return filePath.split(sep).join("/");
}
