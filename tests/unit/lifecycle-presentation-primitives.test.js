// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath) => readFileSync(resolve(process.cwd(), relativePath), "utf8");
const gameHtml = read("pages/game.html");
const lifecycleCss = read("page-assets/css/styles-closed-alpha-ux.css");
const milestoneCss = read("page-assets/css/styles-server-milestone-cards.css");
const gameCss = read("page-assets/css/styles.css");
const runtimeSource = read("page-assets/js/app/runtime.js");

const parseGameDocument = () => new DOMParser().parseFromString(gameHtml, "text/html");

describe("server lifecycle presentation primitives", () => {
  it("uses the canonical modal shell for every blocking lifecycle surface", () => {
    const documentRef = parseGameDocument();
    const surfaces = [
      "[data-game-authority-gate]",
      "[data-elimination-ai-panel]",
      "[data-elimination-result-popup]",
      "[data-server-milestone-modal]"
    ];

    for (const selector of surfaces) {
      const surface = documentRef.querySelector(selector);
      expect(surface, selector).not.toBeNull();
      expect(surface.classList.contains("modal"), selector).toBe(true);
      expect(surface.classList.contains("lifecycle-modal"), selector).toBe(true);
      expect(surface.querySelector(".modal__backdrop.lifecycle-modal__backdrop"), selector).not.toBeNull();
      expect(surface.querySelector(".modal__content.lifecycle-modal__card"), selector).not.toBeNull();
    }

    expect(documentRef.querySelector("[data-elimination-countdown-warning] .lifecycle-status-card"))
      .not.toBeNull();
  });

  it("keeps one shared card and backdrop token set instead of separate shell designs", () => {
    expect(lifecycleCss).toContain(".lifecycle-modal__backdrop {");
    expect(lifecycleCss).toContain(".lifecycle-modal__card {");
    expect(lifecycleCss).toContain(".lifecycle-status-chip,");
    expect(lifecycleCss).toContain(".lifecycle-status-card {");
    expect(milestoneCss).toContain("background: var(--lifecycle-card-background);");
    expect(milestoneCss).toContain("box-shadow: var(--lifecycle-card-shadow);");
    expect(gameCss).toContain("background: var(--lifecycle-card-background) !important;");
    expect(gameCss).toContain("border-color: var(--lifecycle-card-border) !important;");
  });

  it("does not present the server authority gate as a local-demo lifecycle state", () => {
    expect(lifecycleCss).toContain(
      'html[data-gameplay-execution-mode="local-demo"] body.game-body--booting .game-authority-gate { display: none; }'
    );
    expect(lifecycleCss).toContain(
      'html[data-gameplay-execution-mode="local-demo"] body.game-body--booting #game-root { visibility: visible; }'
    );
    expect(runtimeSource).toContain(
      "if (getCurrentGameplayExecutionMode() !== GAMEPLAY_EXECUTION_MODES.serverAuthoritative) {"
    );
    expect(runtimeSource).toContain("onCountdownElapsed: allowDemoFixtures\n      ? () => null");
  });
});
