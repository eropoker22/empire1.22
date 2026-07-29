import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  auditForbiddenBrowserEventDispatches,
  auditLegacyRuntimeImporters,
  auditProductionGameImportGraph,
  collectModuleImports,
  isModuleImportGuardedByLocalDemoMode
} from "../../scripts/production-game-import-graph.mjs";

const fixtureRoots = [];

afterEach(() => {
  const safeTempRoot = resolve(tmpdir());
  for (const fixtureRoot of fixtureRoots.splice(0)) {
    if (!resolve(fixtureRoot).startsWith(safeTempRoot)) {
      throw new Error(`Refusing to remove import-graph fixture outside temp: ${fixtureRoot}`);
    }
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

describe("production game import graph", () => {
  it("publishes only the temporarily restored runtime, not local-demo adapters", () => {
    const buildScript = readFileSync(resolve(process.cwd(), "scripts/build-netlify-client.mjs"), "utf8");
    const requiredPublishFiles =
      buildScript.match(/const requiredPublishFiles = \[([\s\S]*?)\n\];/u)?.[1] ?? "";
    const forbiddenPublishPaths =
      buildScript.match(/const forbiddenPublishPaths = \[([\s\S]*?)\n\];/u)?.[1] ?? "";
    for (const forbiddenPath of [
      "page-assets/js/app-demo.js",
      "page-assets/js/app/render-ui.js",
      "page-assets/js/app/runtime/localDemoFixtureState.js",
      "page-assets/js/app/runtime/localDemoLegacyBootstrap.js"
    ]) {
      expect(buildScript).toContain(`"${forbiddenPath}"`);
    }
    expect(requiredPublishFiles).toContain('"page-assets/js/app/runtime.js",');
    expect(forbiddenPublishPaths).not.toContain('"page-assets/js/app/runtime.js"');
  });

  it("can explicitly record a temporary production compatibility edge", () => {
    const fixtureRoot = createGraphFixture({
      "page-assets/js/app.js": 'import "./app/runtime.js";\n'
    });
    const report = auditProductionGameImportGraph({
      rootDir: fixtureRoot,
      allowedProductionLegacyRuntimeImporters: ["page-assets/js/app.js"]
    });

    expect(report.violations).toEqual([]);
    expect(report.skippedModeEdges).toContainEqual({
      from: "page-assets/js/app.js",
      to: "page-assets/js/app/runtime.js",
      reason: "temporary-legacy-runtime-compatibility",
      chain: [
        "page-assets/js/app-entry.js",
        "page-assets/js/app.js",
        "page-assets/js/app/runtime.js"
      ]
    });
  });

  it("parses multiline imports, export-from and literal dynamic imports", () => {
    const imports = collectModuleImports("fixture.js", `
      import {
        mount
      } from "./presentation.js";
      export { render } from "./renderer.js";
      void import("./effects.js");
      const target = "./computed.js";
      void import(target);
    `);

    expect(imports).toEqual([
      { kind: "static-import", specifier: "./presentation.js" },
      { kind: "export-from", specifier: "./renderer.js" },
      { kind: "dynamic-import", specifier: "./effects.js" },
      { kind: "computed-dynamic", specifier: null }
    ]);
  });

  it("requires the demo import to be structurally guarded by local-demo mode", () => {
    const guardedSource = `
      if (resolveClientEntryExecutionMode() === CLIENT_EXECUTION_MODES.localDemo) {
        void import("./app-demo.js?v=1");
      }
    `;
    const unguardedSource = `
      void import("./app-demo.js?v=1");
      if (resolveClientEntryExecutionMode() === CLIENT_EXECUTION_MODES.localDemo) {
        void import("./app-demo.js?v=1");
      }
    `;
    const unrelatedModeSource = `
      if (window.mode === CLIENT_EXECUTION_MODES.localDemo) {
        void import("./app-demo.js?v=1");
      }
      resolveClientEntryExecutionMode();
    `;

    expect(isModuleImportGuardedByLocalDemoMode(
      "page-assets/js/app-entry.js",
      guardedSource,
      "app-demo.js"
    )).toBe(true);
    expect(isModuleImportGuardedByLocalDemoMode(
      "page-assets/js/app-entry.js",
      unguardedSource,
      "app-demo.js"
    )).toBe(false);
    expect(isModuleImportGuardedByLocalDemoMode(
      "page-assets/js/app-entry.js",
      unrelatedModeSource,
      "app-demo.js"
    )).toBe(false);
  });

  it("discovers module roots from game.html and skips only the explicit local-demo branch", () => {
    const fixtureRoot = createGraphFixture();
    const report = auditFixture(fixtureRoot);
    const modulePaths = report.modules.map((module) => module.path);

    expect(report.violations).toEqual([]);
    expect(report.roots).toEqual([
      "page-assets/js/app-entry.js",
      "page-assets/js/direct.js"
    ]);
    expect(modulePaths).toContain("page-assets/js/app.js");
    expect(modulePaths).toContain("page-assets/js/app/presentation/effects.js");
    expect(modulePaths).toContain("page-assets/js/app/presentation/static.js");
    expect(modulePaths).not.toContain("page-assets/js/app-demo.js");
    expect(modulePaths).not.toContain("page-assets/js/app/runtime.js");
    expect(report.skippedModeEdges).toEqual([
      expect.objectContaining({
        from: "page-assets/js/app-entry.js",
        to: "page-assets/js/app-demo.js",
        reason: "explicit-local-demo-branch",
        chain: [
          "page-assets/js/app-entry.js",
          "page-assets/js/app-demo.js"
        ]
      })
    ]);
    expect(report.sourceBytes).toBe(report.modules.reduce(
      (total, module) => total + Buffer.byteLength(
        readFileSync(join(fixtureRoot, module.path), "utf8"),
        "utf8"
      ),
      0
    ));
  });

  it("reports a complete transitive dependency chain to legacy runtime", () => {
    const fixtureRoot = createGraphFixture({
      "page-assets/js/app/presentation/effects.js": 'export * from "../runtime.js";\n'
    });
    const report = auditFixture(fixtureRoot);
    const violation = report.violations.find((entry) => entry.code === "legacy-runtime-production-import");

    expect(violation).toEqual({
      code: "legacy-runtime-production-import",
      message: expect.stringContaining(
        "page-assets/js/app-entry.js -> page-assets/js/app.js -> "
        + "page-assets/js/app/presentation.js -> page-assets/js/app/presentation/mount.js -> "
        + "page-assets/js/app/presentation/effects.js -> page-assets/js/app/runtime.js"
      ),
      chain: [
        "page-assets/js/app-entry.js",
        "page-assets/js/app.js",
        "page-assets/js/app/presentation.js",
        "page-assets/js/app/presentation/mount.js",
        "page-assets/js/app/presentation/effects.js",
        "page-assets/js/app/runtime.js"
      ]
    });
  });

  it("catches a literal dynamic runtime import from an always-loaded HTML module", () => {
    const fixtureRoot = createGraphFixture({
      "page-assets/js/direct.js": 'void import("./app/runtime.js?cache=1");\n'
    });
    const report = auditFixture(fixtureRoot);

    expect(report.violations).toContainEqual({
      code: "legacy-runtime-production-import",
      message: "Legacy runtime je zakázaný v server-authoritative grafu: "
        + "page-assets/js/direct.js -> page-assets/js/app/runtime.js",
      chain: [
        "page-assets/js/direct.js",
        "page-assets/js/app/runtime.js"
      ]
    });
  });

  it("rejects dynamic local-demo fixtures reached from the production graph", () => {
    const fixtureRoot = createGraphFixture({
      "page-assets/js/app/presentation/effects.js": 'void import("../dev-fixtures/demo.js");\n',
      "page-assets/js/app/dev-fixtures/demo.js": "export const demo = true;\n"
    });
    const report = auditFixture(fixtureRoot);

    expect(report.violations).toContainEqual(expect.objectContaining({
      code: "forbidden-production-import",
      message: expect.stringContaining(
        "page-assets/js/app/presentation/effects.js -> page-assets/js/app/dev-fixtures/demo.js"
      )
    }));
  });

  it("rejects computed dynamic imports that cannot be audited", () => {
    const fixtureRoot = createGraphFixture({
      "page-assets/js/direct.js": `
        const modulePath = "./app/runtime.js";
        void import(modulePath);
      `
    });
    const report = auditFixture(fixtureRoot);

    expect(report.violations).toContainEqual({
      code: "computed-dynamic-import",
      message: expect.stringContaining("produkční dynamický import musí mít statický string"),
      chain: ["page-assets/js/direct.js"]
    });
  });

  it("allows only the explicit local-demo adapter to import legacy runtime", () => {
    const fixtureRoot = createGraphFixture({
      "page-assets/js/app/runtime/localDemoLegacyBootstrap.js": 'export * from "../runtime.js";\n'
    });
    const report = auditLegacyRuntimeImporters({ rootDir: fixtureRoot });

    expect(report.violations).toEqual([]);
    expect(report.importers).toEqual([
      {
        from: "page-assets/js/app/runtime/localDemoLegacyBootstrap.js",
        to: "page-assets/js/app/runtime.js",
        kind: "export-from"
      }
    ]);
  });

  it("rejects any additional legacy runtime importer", () => {
    const fixtureRoot = createGraphFixture({
      "page-assets/js/app/runtime/localDemoLegacyBootstrap.js": 'export * from "../runtime.js";\n',
      "page-assets/js/app/ui/forbidden.js": 'import "../runtime.js";\n'
    });
    const report = auditLegacyRuntimeImporters({ rootDir: fixtureRoot });

    expect(report.violations).toContainEqual({
      code: "unauthorized-legacy-runtime-importer",
      message: "page-assets/js/app/ui/forbidden.js: legacy runtime smí importovat pouze explicitní local-demo adaptér.",
      chain: [
        "page-assets/js/app/ui/forbidden.js",
        "page-assets/js/app/runtime.js"
      ]
    });
  });

  it("rejects legacy local gameplay event dispatches from the production graph", () => {
    const fixtureRoot = createGraphFixture({
      "page-assets/js/app/presentation/effects.js": `
        document.dispatchEvent(new CustomEvent("empire:heat-changed", {
          detail: { heat: 99 }
        }));
      `
    });
    const graph = auditFixture(fixtureRoot);
    const report = auditForbiddenBrowserEventDispatches({
      rootDir: fixtureRoot,
      modulePaths: graph.modules.map((module) => module.path)
    });

    expect(report.violations).toContainEqual({
      code: "forbidden-production-gameplay-event-dispatch",
      message: "page-assets/js/app/presentation/effects.js:2: produkční graf nesmí publikovat legacy lokální gameplay event empire:heat-changed.",
      chain: ["page-assets/js/app/presentation/effects.js"]
    });
  });

  it("rejects a legacy runtime importer outside the app directory", () => {
    const fixtureRoot = createGraphFixture({
      "page-assets/js/app/runtime/localDemoLegacyBootstrap.js": 'export * from "../runtime.js";\n',
      "page-assets/js/forbidden.js": 'import "./app/runtime.js";\n'
    });
    const report = auditLegacyRuntimeImporters({ rootDir: fixtureRoot });

    expect(report.violations).toContainEqual({
      code: "unauthorized-legacy-runtime-importer",
      message: "page-assets/js/forbidden.js: legacy runtime smí importovat pouze explicitní local-demo adaptér.",
      chain: [
        "page-assets/js/forbidden.js",
        "page-assets/js/app/runtime.js"
      ]
    });
  });
});

function auditFixture(rootDir) {
  return auditProductionGameImportGraph({
    rootDir,
    forbiddenPathFragments: [
      "/dev-fixtures/",
      "/onboarding/demoscenarios.js",
      "/app-demo.js"
    ]
  });
}

function createGraphFixture(overrides = {}) {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "empire-production-graph-"));
  fixtureRoots.push(fixtureRoot);
  const files = {
    "pages/game.html": `
      <!doctype html>
      <script type="module" src="../page-assets/js/app-entry.js?v=1"></script>
      <script src="../page-assets/js/direct.js" type="module"></script>
    `,
    "page-assets/js/app-entry.js": `
      import "./app/authority.js";
      if (resolveClientEntryExecutionMode() === CLIENT_EXECUTION_MODES.localDemo) {
        void import("./app-demo.js?v=1");
      } else {
        void import("./app.js?v=1");
      }
    `,
    "page-assets/js/app-demo.js": 'import "./app/runtime/localDemoLegacyBootstrap.js";\n',
    "page-assets/js/app.js": `
      import {
        mount
      } from "./app/presentation.js";
      mount();
    `,
    "page-assets/js/direct.js": 'import "./app/presentation/static.js";\n',
    "page-assets/js/app/authority.js": "export const mode = 'server-authoritative';\n",
    "page-assets/js/app/presentation.js": 'export { mount } from "./presentation/mount.js";\n',
    "page-assets/js/app/presentation/mount.js": `
      export const mount = () => {};
      void import("./effects.js");
    `,
    "page-assets/js/app/presentation/effects.js": "export const effect = true;\n",
    "page-assets/js/app/presentation/static.js": "export const staticLayer = true;\n",
    "page-assets/js/app/runtime/localDemoLegacyBootstrap.js": 'export * from "../runtime.js";\n',
    "page-assets/js/app/runtime.js": "export const legacyRuntime = true;\n",
    ...overrides
  };

  for (const [relativePath, source] of Object.entries(files)) {
    const target = join(fixtureRoot, relativePath);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, source, "utf8");
  }
  return fixtureRoot;
}
