import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relativePath) => readFileSync(resolve(root, relativePath), "utf8");

describe("runtime lifecycle contract", () => {
  it("destroys local-demo authority before allowing a clean remount", () => {
    const runtimeSource = read("page-assets/js/app/runtime.js");
    const bootstrapSource = read("page-assets/js/app/runtime/localDemoLegacyBootstrap.js");

    expect(runtimeSource).toContain("function destroyRuntime(root = getDefaultRuntimeRoot())");
    expect(runtimeSource).toContain("destroyLegacyRuntimeLifecycle(");
    expect(runtimeSource).toContain("runtimeUiBoundRoots.delete(resolvedRoot);");
    expect(runtimeSource).toContain("runtimeInitializedRoots.delete(resolvedRoot);");
    expect(runtimeSource).toContain("unregisterRuntimePublicHandlers({ windowRef });");
    expect(bootstrapSource).toContain("root?.dataset?.runtimeInit === \"server-authoritative\"");
    expect(bootstrapSource).toContain('root.dataset.gameplayAuthority = "local-demo";');
    expect(bootstrapSource).toContain("setE2eDistrictBuildingPopulationBuffer");
    expect(bootstrapSource).toContain("resolveBountyDemoTargets(getStoredPreviewSession())");
    expect(bootstrapSource).toContain("destroyRuntime(root);");
    expect(bootstrapSource).toContain("delete root.dataset.gameplayAuthority;");
    expect(bootstrapSource).toContain("uninstallLocalDemoGameplayBridge();");
    expect(bootstrapSource).toMatch(
      /publishExecutionMode\([\s\S]*?"server-authoritative",[\s\S]*?"local-demo-destroy"[\s\S]*?empire:runtime-mode-changed/u
    );
  });

  it("keeps alliance countdown work visibility-bound and cleans standalone bindings", () => {
    const allianceSource = read("page-assets/js/app/alliance-runtime.js");

    expect(allianceSource).toContain("if (allianceRuntimeMounted) return false;");
    expect(allianceSource).toContain("document.hidden");
    expect(allianceSource).toContain("hasVisibleAllianceReadyCountdown()");
    expect(allianceSource).toContain("stopAllianceCountdownTimer();");
    expect(allianceSource).toContain('document.addEventListener("visibilitychange", syncAllianceCountdownTimer);');
    expect(allianceSource).toContain('window.addEventListener("pagehide", destroyAllianceRuntime, { once: true });');
    expect(allianceSource).toContain("allianceCreateInfluenceObserver?.disconnect?.();");
    expect(allianceSource).toContain(
      "destroyLegacyRuntimeLifecycle(root, ALLIANCE_RUNTIME_LIFECYCLE_OWNER);"
    );
    expect(allianceSource).not.toContain("ensureAllianceCountdownTimer");
  });

  it("remounts the local demo after BFCache without duplicating page lifecycle handlers", () => {
    const appDemoSource = read("page-assets/js/app-demo.js");

    expect(appDemoSource).toContain('window.addEventListener("pagehide", handlePageHide);');
    expect(appDemoSource).toContain('window.addEventListener("pageshow", handlePageShow);');
    expect(appDemoSource).toContain("event?.persisted === true || !activeRuntime");
    expect(appDemoSource).toContain("desktopScrollController?.destroy?.();");
    expect(appDemoSource).not.toMatch(
      /window\.addEventListener\("pagehide",\s*\(\)\s*=>[\s\S]*?\{\s*once:\s*true\s*\}/u
    );
  });
});
