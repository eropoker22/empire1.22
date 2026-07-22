// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const gameSource = readFileSync("pages/game.html", "utf8");
const runtimeSource = readFileSync("page-assets/js/app/faction-actions-runtime.js", "utf8");

function mountFactionModal() {
  document.body.innerHTML = `
    <main data-client-surface="game-shell">
      <button type="button" data-faction-actions-open-trigger>Frakce</button>
      <div id="faction-actions-modal" class="modal hidden" hidden>
        <button id="faction-actions-modal-backdrop" type="button">Zavřít</button>
        <p>Speciální schopnosti frakce se zatím připravují</p>
      </div>
    </main>`;
}

describe("faction actions runtime", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.replaceChildren();
  });

  it("keeps the faction window limited to the planned ability notice", () => {
    expect(gameSource).toContain("Speciální schopnosti frakce se zatím připravují");
    expect(gameSource).not.toContain("data-faction-action-run");
    expect(runtimeSource).not.toContain("localStorage");
    expect(runtimeSource).not.toContain("getFactionActionForPlayer");
  });

  it("opens and closes the existing faction modal without creating a preview command", async () => {
    mountFactionModal();
    await import("../../page-assets/js/app/faction-actions-runtime.js");

    const modal = document.getElementById("faction-actions-modal");
    document.querySelector("[data-faction-actions-open-trigger]").click();
    expect(modal.hidden).toBe(false);
    expect(modal.classList.contains("hidden")).toBe(false);

    document.getElementById("faction-actions-modal-backdrop").click();
    expect(modal.hidden).toBe(true);
    expect(modal.classList.contains("hidden")).toBe(true);
  });

  it("closes the faction modal with Escape", async () => {
    mountFactionModal();
    await import("../../page-assets/js/app/faction-actions-runtime.js");

    const modal = document.getElementById("faction-actions-modal");
    document.querySelector("[data-faction-actions-open-trigger]").click();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(modal.hidden).toBe(true);
  });
});
