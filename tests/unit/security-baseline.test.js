import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const readProjectFile = (path) => readFileSync(resolve(root, path), "utf8");

describe("security baseline", () => {
  it("does not persist account passwords in the preview auth session", () => {
    const authFlow = readProjectFile("page-assets/js/app/auth-flow.js");
    const authorityState = readProjectFile("page-assets/js/app/model/authority-state.js");

    expect(authFlow).not.toContain("password:");
    expect(authorityState).toContain("const { password, ...safeRegistration } = registration;");
  });

  it("keeps the game page from eagerly loading debug admin bundles", () => {
    const gamePage = readProjectFile("pages/game.html");

    expect(gamePage).not.toContain("page-assets/js/admin-assets/admin-slice-demo.js");
    expect(gamePage).toContain("game-admin-slice-launcher.js");
    expect(gamePage).toMatch(/<button[^>]+data-slice-panel-open[^>]+hidden/u);
  });

  it("keeps deprecated compatibility packages out of source imports", () => {
    const architectureCheck = readProjectFile("scripts/check-architecture.mjs");

    expect(architectureCheck).toContain("@empire\\/shared");
    expect(architectureCheck).toContain("@empire\\/debug-tools");
  });

  it("keeps browser storage outside authoritative runtime boundaries", () => {
    const architectureCheck = readProjectFile("scripts/check-architecture.mjs");

    expect(architectureCheck).toContain('scope: "apps/server/src"');
    expect(architectureCheck).toContain('scope: "packages/game-core/src"');
    expect(architectureCheck).toContain('"localStorage"');
  });
});
