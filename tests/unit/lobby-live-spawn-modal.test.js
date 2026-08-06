import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");

describe("live lobby spawn modal cold-start contract", () => {
  it("reveals an explicit loading state before awaiting spawn districts", () => {
    const source = readFileSync(resolve(root, "page-assets/js/lobby-live.js"), "utf8");
    const start = source.indexOf("async function openSpawnModal");
    const end = source.indexOf("function closeSpawnModal", start);
    const openSpawnModal = source.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(openSpawnModal).toContain('modal?.setAttribute("data-load-state", "loading")');
    expect(openSpawnModal).toContain('modal?.setAttribute("data-load-state", "ready")');
    expect(openSpawnModal).toContain('modal?.setAttribute("data-load-state", "error")');
    expect(openSpawnModal.indexOf('modal?.classList.remove("hidden")')).toBeLessThan(
      openSpawnModal.indexOf("await loadSpawnDistricts(serverInstanceId)")
    );
  });

  it("renders the selected server starting materials below the map", () => {
    const source = readFileSync(resolve(root, "page-assets/js/lobby-live.js"), "utf8");
    const page = readFileSync(resolve(root, "pages/lobby.html"), "utf8");
    const sharedStyles = readFileSync(resolve(root, "page-assets/css/styles-auth-faction.css"), "utf8");
    const lobbyStyles = readFileSync(resolve(root, "page-assets/css/lobby.css"), "utf8");

    expect(page).not.toContain("data-server-detail-start");
    expect(sharedStyles).toMatch(/\.server-detail-modal__meta\s*\{[^}]*grid-template-columns:\s*repeat\(3,/s);
    expect(sharedStyles).not.toMatch(/\.server-detail-modal__meta\s*\{[^}]*grid-template-columns:\s*(?:1fr|repeat\(2,)/s);
    expect(lobbyStyles).not.toMatch(/\.server-detail-modal__meta\s*\{[^}]*grid-template-columns:\s*1fr/s);
    expect(source).toContain("renderStartingMaterials(state.spawn.startingPlayerState)");
    expect(source).toContain("Number(amount) > 0");
    expect(source).toContain("STARTING_MATERIAL_LABELS[materialId]");
  });

  it("keeps the district confirmation action reachable on short desktop viewports", () => {
    const lobbyStyles = readFileSync(resolve(root, "page-assets/css/lobby.css"), "utf8");
    const cardRule = /\.server-detail-modal__card\s*\{([^}]*)\}/su.exec(lobbyStyles)?.[1] ?? "";

    expect(cardRule).toContain("max-height: calc(100dvh - 32px)");
    expect(cardRule).toContain("overflow-y: auto");
    expect(cardRule).toContain("overscroll-behavior: contain");
  });

  it("uses the authoritative online presence count instead of server memberships", () => {
    const source = readFileSync(resolve(root, "page-assets/js/lobby-live.js"), "utf8");

    expect(source).toContain("formatOnlinePlayerCount(overview.onlinePlayerCount)");
    expect(source).not.toContain("availableServers.reduce((sum, server) => sum + server.committedPlayers");
  });
});
