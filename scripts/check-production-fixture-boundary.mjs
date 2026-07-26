import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  auditForbiddenBrowserEventDispatches,
  auditLegacyRuntimeImporters,
  auditProductionGameImportGraph,
  isModuleImportGuardedByLocalDemoMode
} from "./production-game-import-graph.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const additionalProductionRoots = [
  "page-assets/js/login-live.js",
  "page-assets/js/lobby-live.js",
  "page-assets/js/faction-live.js",
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
  "/persistence/legacystorage.js",
  "/runtime/localdemolegacybootstrap.js",
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
const requiredPublishExclusions = [
  "page-assets/js/app-demo.js",
  "page-assets/js/app/render-ui.js",
  "page-assets/js/app/runtime.js",
  "page-assets/js/app/runtime/localDemoFixtureState.js",
  "page-assets/js/app/runtime/localDemoLegacyBootstrap.js"
];
const errors = [];
const importGraph = auditProductionGameImportGraph({
  rootDir: root,
  additionalRootFiles: additionalProductionRoots,
  forbiddenPathFragments: forbiddenGraphFragments,
  forbiddenContent: forbiddenSeedText
});
errors.push(...importGraph.violations.map((violation) => violation.message));
const legacyRuntimeImporters = auditLegacyRuntimeImporters({ rootDir: root });
errors.push(...legacyRuntimeImporters.violations.map((violation) => violation.message));
const browserEventAudit = auditForbiddenBrowserEventDispatches({
  rootDir: root,
  modulePaths: [
    ...importGraph.modules.map((module) => module.path),
    "apps/client/src/browser/gameplay-slice-browser-entry.ts",
    "apps/client/src/browser/gameplay-slice-page.ts"
  ]
});
errors.push(...browserEventAudit.violations.map((violation) => violation.message));
const publishScript = readFileSync(resolve(root, "scripts/build-netlify-client.mjs"), "utf8");
for (const excludedPath of requiredPublishExclusions) {
  if (!publishScript.includes(`"${excludedPath}"`)) {
    errors.push(`scripts/build-netlify-client.mjs: produkční publish musí odstranit ${excludedPath}.`);
  }
}

for (const [entrypoint, liveModule, demoModule] of entrypoints) {
  const source = readFileSync(resolve(root, entrypoint), "utf8");
  if (!source.includes("resolveClientEntryExecutionMode") || !source.includes(liveModule) || !source.includes(demoModule)) {
    errors.push(`${entrypoint}: entrypoint nemá explicitní authority volbu mezi live a demo modulem.`);
  }
  if (!source.includes("CLIENT_EXECUTION_MODES.localDemo")) {
    errors.push(`${entrypoint}: demo import není chráněný explicitním local-demo režimem.`);
  } else if (!isModuleImportGuardedByLocalDemoMode(entrypoint, source, demoModule)) {
    errors.push(`${entrypoint}: demo import není strukturálně uvnitř CLIENT_EXECUTION_MODES.localDemo větve.`);
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
  console.log(
    `Production fixture boundary OK (${importGraph.moduleCount} live modulů, `
    + `${importGraph.sourceBytes} B zdrojového JS, ${productionPages.length} stránek).`
  );
}
