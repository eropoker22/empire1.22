import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, relative, resolve, sep } from "node:path";
import {
  collectModuleImports,
  isModuleImportGuardedByLocalDemoMode
} from "./browser-module-import-parser.mjs";

export {
  collectModuleImports,
  isModuleImportGuardedByLocalDemoMode
} from "./browser-module-import-parser.mjs";

const DEFAULT_GAME_HTML_PATH = "pages/game.html";
const DEFAULT_LEGACY_RUNTIME_PATH = "page-assets/js/app/runtime.js";
const APP_ENTRY_PATH = "page-assets/js/app-entry.js";
const LOCAL_DEMO_ENTRY_PATH = "page-assets/js/app-demo.js";
const DEFAULT_APPLICATION_ROOT = "page-assets/js";
const DEFAULT_ALLOWED_LEGACY_IMPORTERS = [
  "page-assets/js/app/runtime/localDemoLegacyBootstrap.js"
];
export const LEGACY_LOCAL_GAMEPLAY_EVENT_NAMES = Object.freeze([
  "empire:attack-started",
  "empire:bounty-action-resolved",
  "empire:economy-state-changed",
  "empire:elimination-resolved",
  "empire:gang-state-changed",
  "empire:heat-changed",
  "empire:occupy-started",
  "empire:player-boost-lifecycle",
  "empire:player-boost-state-change",
  "empire:police-raid-acknowledged",
  "empire:police-state-changed",
  "empire:production-collected",
  "empire:production-state-change",
  "empire:robbery-started",
  "empire:spy-started",
  "empire:world-state-changed"
]);

export function auditProductionGameImportGraph(options = {}) {
  const rootDir = resolve(options.rootDir ?? process.cwd());
  const gameHtmlPath = normalizeRelativePath(options.gameHtmlPath ?? DEFAULT_GAME_HTML_PATH);
  const legacyRuntimePath = normalizeRelativePath(options.legacyRuntimePath ?? DEFAULT_LEGACY_RUNTIME_PATH);
  const allowedProductionLegacyRuntimeImporters = new Set(
    (options.allowedProductionLegacyRuntimeImporters ?? [])
      .map((filePath) => normalizeRelativePath(filePath).toLowerCase())
  );
  const forbiddenPathFragments = (options.forbiddenPathFragments ?? []).map((fragment) =>
    normalizeRelativePath(fragment).toLowerCase()
  );
  const forbiddenContent = options.forbiddenContent ?? [];
  const violations = [];
  const moduleDetails = new Map();
  const skippedModeEdges = [];
  const gameHtmlFile = resolve(rootDir, gameHtmlPath);
  const rootFiles = [
    ...discoverGameModuleRoots(rootDir, gameHtmlFile, violations),
    ...(options.additionalRootFiles ?? []).map((file) => resolve(rootDir, file))
  ];

  for (const rootFile of rootFiles) {
    walkModule(rootFile, []);
  }

  const modules = [...moduleDetails.values()].sort((left, right) => left.path.localeCompare(right.path));
  return {
    rootDir,
    gameHtmlPath,
    legacyRuntimePath,
    roots: uniqueRelativePaths(rootDir, rootFiles),
    modules,
    moduleCount: modules.length,
    sourceBytes: modules.reduce((total, module) => total + module.sourceBytes, 0),
    skippedModeEdges,
    violations
  };

  function walkModule(filePath, parentChain) {
    const absoluteFile = resolve(filePath);
    const relativeFile = toRelativePath(rootDir, absoluteFile);
    const chain = [...parentChain, relativeFile];
    if (moduleDetails.has(relativeFile)) return;
    if (!existsSync(absoluteFile)) {
      violations.push(createViolation(
        "missing-production-module",
        `Produkční importní graf odkazuje na chybějící modul: ${formatChain(chain)}`,
        chain
      ));
      return;
    }

    const source = readFileSync(absoluteFile, "utf8");
    moduleDetails.set(relativeFile, {
      path: relativeFile,
      sourceBytes: Buffer.byteLength(source, "utf8"),
      chain
    });

    for (const forbidden of forbiddenContent) {
      if (source.includes(forbidden)) {
        violations.push(createViolation(
          "forbidden-production-content",
          `${relativeFile}: live graf obsahuje zakázaný obsah ${JSON.stringify(forbidden)} (${formatChain(chain)})`,
          chain
        ));
      }
    }

    const imports = collectModuleImports(absoluteFile, source);
    for (const moduleImport of imports) {
      if (moduleImport.kind === "computed-dynamic") {
        violations.push(createViolation(
          "computed-dynamic-import",
          `${relativeFile}: produkční dynamický import musí mít statický string, aby šel bezpečně auditovat (${formatChain(chain)})`,
          chain
        ));
        continue;
      }

      const imported = stripQueryAndHash(moduleImport.specifier);
      if (!imported.startsWith(".") && !imported.startsWith("/")) continue;
      const resolvedImport = resolveImport(rootDir, dirname(absoluteFile), imported);
      const unresolvedPath = resolvedImport ?? resolveRelativeImport(rootDir, dirname(absoluteFile), imported);
      const relativeImport = toRelativePath(rootDir, unresolvedPath);
      const dependencyChain = [...chain, relativeImport];

      if (isLocalDemoBranch(relativeFile, relativeImport)) {
        if (!isModuleImportGuardedByLocalDemoMode(
          absoluteFile,
          source,
          moduleImport.specifier
        )) {
          violations.push(createViolation(
            "unguarded-local-demo-import",
            `${relativeFile}: local-demo import není uvnitř explicitní CLIENT_EXECUTION_MODES.localDemo větve.`,
            dependencyChain
          ));
          continue;
        }
        skippedModeEdges.push({
          from: relativeFile,
          to: relativeImport,
          reason: "explicit-local-demo-branch",
          chain: dependencyChain
        });
        continue;
      }

      if (!resolvedImport) {
        violations.push(createViolation(
          "unresolved-production-import",
          `${relativeFile}: nelze rozlišit produkční import ${JSON.stringify(moduleImport.specifier)} (${formatChain(dependencyChain)})`,
          dependencyChain
        ));
        continue;
      }

      if (relativeImport.toLowerCase() === legacyRuntimePath.toLowerCase()) {
        if (allowedProductionLegacyRuntimeImporters.has(relativeFile.toLowerCase())) {
          skippedModeEdges.push({
            from: relativeFile,
            to: relativeImport,
            reason: "temporary-legacy-runtime-compatibility",
            chain: dependencyChain
          });
          continue;
        }
        violations.push(createViolation(
          "legacy-runtime-production-import",
          `Legacy runtime je zakázaný v server-authoritative grafu: ${formatChain(dependencyChain)}`,
          dependencyChain
        ));
        continue;
      }

      const normalizedImport = `/${relativeImport.toLowerCase()}`;
      const forbiddenFragment = forbiddenPathFragments.find((fragment) =>
        normalizedImport.endsWith(fragment) || normalizedImport.includes(fragment)
      );
      if (forbiddenFragment) {
        violations.push(createViolation(
          "forbidden-production-import",
          `Zakázaný produkční import (${forbiddenFragment}): ${formatChain(dependencyChain)}`,
          dependencyChain
        ));
        continue;
      }

      walkModule(resolvedImport, chain);
    }
  }
}

export function auditLegacyRuntimeImporters(options = {}) {
  const rootDir = resolve(options.rootDir ?? process.cwd());
  const applicationRoot = normalizeRelativePath(options.applicationRoot ?? DEFAULT_APPLICATION_ROOT);
  const legacyRuntimePath = normalizeRelativePath(options.legacyRuntimePath ?? DEFAULT_LEGACY_RUNTIME_PATH);
  const allowedImporters = new Set(
    (options.allowedImporters ?? DEFAULT_ALLOWED_LEGACY_IMPORTERS)
      .map((filePath) => normalizeRelativePath(filePath).toLowerCase())
  );
  const importers = [];
  const violations = [];

  for (const absoluteFile of discoverJavaScriptFiles(resolve(rootDir, applicationRoot))) {
    const relativeFile = toRelativePath(rootDir, absoluteFile);
    const source = readFileSync(absoluteFile, "utf8");
    for (const moduleImport of collectModuleImports(absoluteFile, source)) {
      if (moduleImport.kind === "computed-dynamic") continue;
      const imported = stripQueryAndHash(moduleImport.specifier);
      if (!imported.startsWith(".") && !imported.startsWith("/")) continue;
      const resolvedImport = resolveImport(rootDir, dirname(absoluteFile), imported);
      if (!resolvedImport) continue;
      const relativeImport = toRelativePath(rootDir, resolvedImport);
      if (relativeImport.toLowerCase() !== legacyRuntimePath.toLowerCase()) continue;

      const importer = {
        from: relativeFile,
        to: relativeImport,
        kind: moduleImport.kind
      };
      importers.push(importer);
      if (!allowedImporters.has(relativeFile.toLowerCase())) {
        violations.push(createViolation(
          "unauthorized-legacy-runtime-importer",
          `${relativeFile}: legacy runtime smí importovat pouze explicitní local-demo adaptér.`,
          [relativeFile, relativeImport]
        ));
      }
    }
  }

  if (importers.length === 0) {
    violations.push(createViolation(
      "missing-local-demo-legacy-importer",
      "Explicitní local-demo adaptér neimportuje legacy runtime; architektonický kontrakt nelze ověřit.",
      []
    ));
  }

  return {
    rootDir,
    applicationRoot,
    legacyRuntimePath,
    allowedImporters: [...allowedImporters],
    importers,
    violations
  };
}

export function auditForbiddenBrowserEventDispatches(options = {}) {
  const rootDir = resolve(options.rootDir ?? process.cwd());
  const modulePaths = options.modulePaths ?? auditProductionGameImportGraph({ rootDir })
    .modules
    .map((module) => module.path);
  const forbiddenEventNames = new Set(
    options.forbiddenEventNames ?? LEGACY_LOCAL_GAMEPLAY_EVENT_NAMES
  );
  const violations = [];
  const dispatches = [];

  for (const modulePath of modulePaths) {
    const normalizedPath = normalizeRelativePath(modulePath);
    const absoluteFile = resolve(rootDir, normalizedPath);
    if (!existsSync(absoluteFile)) {
      violations.push(createViolation(
        "missing-event-audit-module",
        `${normalizedPath}: modul pro audit browser eventů chybí.`,
        [normalizedPath]
      ));
      continue;
    }

    const source = readFileSync(absoluteFile, "utf8");
    for (const occurrence of collectLiteralBrowserEventDispatches(source)) {
      const dispatch = {
        path: normalizedPath,
        eventName: occurrence.eventName,
        line: occurrence.line
      };
      dispatches.push(dispatch);
      if (!forbiddenEventNames.has(occurrence.eventName)) continue;
      violations.push(createViolation(
        "forbidden-production-gameplay-event-dispatch",
        `${normalizedPath}:${occurrence.line}: produkční graf nesmí publikovat legacy lokální gameplay event ${occurrence.eventName}.`,
        [normalizedPath]
      ));
    }
  }

  return {
    forbiddenEventNames: [...forbiddenEventNames],
    dispatches,
    violations
  };
}

function discoverGameModuleRoots(rootDir, gameHtmlFile, violations) {
  if (!existsSync(gameHtmlFile)) {
    violations.push(createViolation(
      "missing-game-html",
      `${toRelativePath(rootDir, gameHtmlFile)} chybí, produkční module roots nelze určit.`,
      [toRelativePath(rootDir, gameHtmlFile)]
    ));
    return [];
  }

  const html = readFileSync(gameHtmlFile, "utf8");
  const roots = [];
  for (const match of html.matchAll(/<script\b[^>]*>/giu)) {
    const tag = match[0];
    const type = readHtmlAttribute(tag, "type");
    const source = readHtmlAttribute(tag, "src");
    if (type?.toLowerCase() !== "module" || !source || isExternalUrl(source)) continue;
    roots.push(resolveHtmlModule(rootDir, dirname(gameHtmlFile), stripQueryAndHash(source)));
  }
  return roots;
}

function discoverJavaScriptFiles(directory) {
  if (!existsSync(directory)) return [];
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...discoverJavaScriptFiles(entryPath));
    } else if (/\.(?:js|mjs)$/iu.test(entry.name)) {
      files.push(entryPath);
    }
  }
  return files;
}

function readHtmlAttribute(tag, name) {
  return tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "iu"))?.[1] ?? null;
}

function resolveHtmlModule(rootDir, pageDirectory, specifier) {
  return specifier.startsWith("/")
    ? resolve(rootDir, specifier.slice(1))
    : resolve(pageDirectory, specifier);
}

function resolveImport(rootDir, baseDirectory, specifier) {
  const candidate = resolveRelativeImport(rootDir, baseDirectory, specifier);
  const candidates = extname(candidate)
    ? [candidate]
    : [
        candidate,
        `${candidate}.js`,
        `${candidate}.mjs`,
        `${candidate}.ts`,
        resolve(candidate, "index.js"),
        resolve(candidate, "index.ts")
      ];
  return candidates.find((entry) => existsSync(entry)) ?? null;
}

function resolveRelativeImport(rootDir, baseDirectory, specifier) {
  return specifier.startsWith("/")
    ? resolve(rootDir, specifier.slice(1))
    : resolve(baseDirectory, specifier);
}

function isLocalDemoBranch(fromPath, toPath) {
  return fromPath.toLowerCase() === APP_ENTRY_PATH.toLowerCase()
    && toPath.toLowerCase() === LOCAL_DEMO_ENTRY_PATH.toLowerCase();
}

function isExternalUrl(specifier) {
  return /^(?:[a-z]+:)?\/\//iu.test(specifier);
}

function stripQueryAndHash(specifier) {
  return specifier.split(/[?#]/u, 1)[0];
}

function uniqueRelativePaths(rootDir, files) {
  return [...new Set(files.map((file) => toRelativePath(rootDir, resolve(file))))].sort();
}

function toRelativePath(rootDir, filePath) {
  return normalizeRelativePath(relative(rootDir, filePath));
}

function normalizeRelativePath(filePath) {
  return String(filePath).split(sep).join("/").replace(/^\.\//u, "");
}

function formatChain(chain) {
  return chain.join(" -> ");
}

function createViolation(code, message, chain) {
  return {
    code,
    message,
    chain
  };
}

function collectLiteralBrowserEventDispatches(source) {
  const occurrences = [];
  const pattern = /dispatchEvent\s*(?:\?\.)?\s*\(\s*new\s+[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\s*\(\s*["'](empire:[A-Za-z0-9:_-]+)["']/gu;
  for (const match of source.matchAll(pattern)) {
    occurrences.push({
      eventName: match[1],
      line: source.slice(0, match.index).split(/\r?\n/u).length
    });
  }
  return occurrences;
}
