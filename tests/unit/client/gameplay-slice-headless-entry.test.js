import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path) => readFileSync(resolve(process.cwd(), path), "utf8");

const forbiddenRendererTokens = [
  "district-panel__slot",
  "spawn-selection-panel",
  "createDistrictSheetOverlayController",
  "renderGameplaySliceStatus",
  "gameplay-slice-backdrop"
];

describe("headless gameplay slice browser entry", () => {
  it("keeps the production mount data-only and outside the old stylesheet", () => {
    const page = read("pages/game.html");
    const mount = page.match(/<section\s+[\s\S]*?data-gameplay-slice-client[\s\S]*?<\/section>/u)?.[0] ?? "";

    expect(page).not.toContain("styles-gameplay-slice-client.css");
    expect(mount).toContain("hidden");
    expect(mount).toContain('data-gameplay-slice-presentation-mode="controller-only"');
    expect(mount).not.toContain("data-gameplay-slice-status");
    expect(mount).not.toContain("data-gameplay-slice-topbar");
    expect(mount).not.toContain("data-gameplay-slice-map");
    expect(mount).not.toContain("data-gameplay-slice-panel");
    expect(existsSync(resolve(process.cwd(), "page-assets/css/styles-gameplay-slice-client.css"))).toBe(false);
  });

  it("keeps HTML renderers, overlay presentation, and feature barrels out of the browser path", () => {
    const page = read("apps/client/src/browser/gameplay-slice-page.ts");
    const surfaceActions = read("apps/client/src/app/client-surface-actions.ts");
    const responseCommitter = read("apps/client/src/app/client-response-committer.ts");

    expect(page).toContain("createControllerClientApp");
    expect(page).not.toContain("createClientApp,");
    expect(page).not.toContain("gameplay-slice-selective-renderer");
    expect(page).not.toContain("gameplay-slice-overlays");
    expect(page).not.toContain("../modals/");
    expect(surfaceActions).not.toMatch(/from\s+["']\.\.\/features["']/u);
    expect(responseCommitter).not.toMatch(/from\s+["']\.\.\/features["']/u);
  });

  it("keeps old renderer tokens out of the generated player bundle", () => {
    const bundle = read("page-assets/js/client-assets/gameplay-slice-client.js");

    for (const token of forbiddenRendererTokens) {
      expect(bundle, token).not.toContain(token);
    }
  });
});
