import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const runtimeSource = readFileSync(
  resolve(process.cwd(), "page-assets/js/app/runtime.js"),
  "utf8"
);

describe("server report hydration guard", () => {
  it("records initial reports without announcing historical result modals", () => {
    const hydrationStart = runtimeSource.indexOf("const seenServerConflictReportIds = new Set()");
    const hydrationEnd = runtimeSource.indexOf("const ensureMissionAnimationLoop", hydrationStart);
    const hydration = runtimeSource.slice(hydrationStart, hydrationEnd);

    expect(hydrationStart).toBeGreaterThan(-1);
    expect(hydration).toContain("let serverConflictReportsHydrated = false");
    expect(hydration).toContain("syncServerConflictReports(root, initialServerReports, seenServerConflictReportIds);");
    expect(hydration).toContain("serverConflictReportsHydrated = true");
    expect(hydration).not.toContain("announce: true");
  });

  it("announces only reports received after initial hydration", () => {
    const renderHandlerStart = runtimeSource.indexOf("const handleServerSliceRendered");
    const renderHandlerEnd = runtimeSource.indexOf(
      'window.addEventListener("empire:mobile-performance-mode-changed"',
      renderHandlerStart
    );
    const renderHandler = runtimeSource.slice(renderHandlerStart, renderHandlerEnd);

    expect(renderHandlerStart).toBeGreaterThan(-1);
    expect(renderHandler).toContain("announce: serverConflictReportsHydrated");
    expect(renderHandler).toContain("serverConflictReportsHydrated = true");
  });
});
