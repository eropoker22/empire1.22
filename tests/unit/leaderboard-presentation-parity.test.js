/* @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";

const MODULE_PATH = "../../page-assets/js/app/features/leaderboard.js";
const TAB_IDS = ["overall", "influence", "districts", "money", "wanted", "attacks", "alliance"];
const FILTER_IDS = ["current", "free", "war", "alliance", "active"];

function createLeaderboardShell() {
  document.body.innerHTML = `
    <button type="button" data-leaderboard-popup-open>Leaderboard</button>
    <div class="leaderboard-popup-shell" data-leaderboard-popup hidden>
      <button type="button" data-leaderboard-popup-close>Zavřít</button>
      <div class="leaderboard-popup-card leaderboard-terminal-card" tabindex="-1">
        <div class="leaderboard-terminal">
          <header class="leaderboard-terminal__header">
            <span data-leaderboard-server-badge></span>
            <strong data-leaderboard-phase></strong>
          </header>
          <section class="leaderboard-control-strip">
            <input type="search" data-leaderboard-search>
            ${FILTER_IDS.map((id, index) => `<button class="button leaderboard-filter${index === 0 ? " is-active" : ""}" data-leaderboard-filter="${id}">${id}</button>`).join("")}
          </section>
          <div class="leaderboard-popup-tabs">
            ${TAB_IDS.map((id, index) => `<button class="button leaderboard-popup-tab${index === 0 ? " is-active" : ""}" data-leaderboard-tab="${id}">${id}</button>`).join("")}
          </div>
          <div class="leaderboard-terminal__body">
            <aside class="leaderboard-my-rank" data-leaderboard-my-rank></aside>
            <section class="leaderboard-board">
              <span data-leaderboard-mode-label></span>
              <h4 data-leaderboard-table-title></h4>
              <span data-leaderboard-count></span>
              <div class="leaderboard-popup-stats" data-leaderboard-stats></div>
              <div class="leaderboard-popup-list" data-leaderboard-list></div>
            </section>
          </div>
          <div class="leaderboard-player-detail-shell" data-leaderboard-player-detail hidden>
            <section class="leaderboard-player-detail-card">
              <button type="button" data-leaderboard-player-detail-close>Zavřít detail</button>
              <div class="leaderboard-detail-panel" data-leaderboard-detail></div>
            </section>
          </div>
          <div data-leaderboard-toast hidden>
            <strong data-leaderboard-toast-title></strong>
            <span data-leaderboard-toast-message></span>
          </div>
        </div>
      </div>
    </div>
  `;
}

function createAuthoritativeReadModel() {
  const currentPlayer = {
    rank: 1,
    playerId: "player:hosted",
    name: "Hosted Boss",
    gangName: "Hosted Crew",
    factionId: "mafia",
    allianceTag: "PACT",
    controlledDistricts: 8,
    influence: 590,
    score: 51_200,
    status: "active",
    movement: 0,
    isCurrentPlayer: true
  };
  return {
    server: { serverInstanceId: "instance:free:parity" },
    mode: { mode: "free" },
    player: {
      dayNight: {
        phaseId: "night",
        gameClockLabel: "05:55"
      }
    },
    leaderboard: {
      generatedAt: "2026-08-01T05:55:00.000Z",
      entries: [currentPlayer],
      currentPlayer
    }
  };
}

function elementSchema(element) {
  if (!element) return null;
  return {
    tag: element.tagName,
    classes: Array.from(element.classList).filter((className) => (
      !className.startsWith("is-rank-")
      && !className.startsWith("leaderboard-wanted--")
    )),
    children: Array.from(element.children).map(elementSchema)
  };
}

function textList(selector, childSelector = null) {
  const root = document.querySelector(selector);
  const elements = childSelector ? root?.querySelectorAll(childSelector) : [];
  return Array.from(elements || []).map((element) => element.textContent.trim());
}

async function renderMode(mode, readModel = null) {
  vi.resetModules();
  createLeaderboardShell();
  window.__EMPIRE_GAMEPLAY_EXECUTION_MODE__ = mode;
  if (readModel) {
    window.empireStreetsGameplaySliceReadModel = readModel;
  } else {
    delete window.empireStreetsGameplaySliceReadModel;
  }

  const leaderboard = await import(MODULE_PATH);
  leaderboard.bindLeaderboardPopup(document);
  if (mode === "local-demo") {
    await vi.waitFor(() => expect(leaderboard.getLeaderboardPlayers().length).toBeGreaterThan(0));
  }
  const currentPlayer = leaderboard.getLeaderboardPlayers().find((player) => player.isCurrentPlayer);
  leaderboard.leaderboardState.selectedServerId = currentPlayer?.serverId || null;
  leaderboard.leaderboardState.modeFilter = "current";
  leaderboard.renderLeaderboard();
  return leaderboard;
}

function capturePresentation() {
  const currentRow = document.querySelector("[data-leaderboard-player-id].is-current");
  const presentation = {
    title: document.querySelector("[data-leaderboard-table-title]")?.textContent.trim(),
    tabOrder: textList(".leaderboard-popup-tabs", "[data-leaderboard-tab]"),
    tabClasses: Array.from(document.querySelectorAll("[data-leaderboard-tab]"), (tab) => Array.from(tab.classList)),
    filterOrder: textList(".leaderboard-control-strip", "[data-leaderboard-filter]"),
    filterClasses: Array.from(document.querySelectorAll("[data-leaderboard-filter]"), (filter) => Array.from(filter.classList)),
    summaryLabels: textList("[data-leaderboard-stats]", "small"),
    tableHeaders: textList("[data-leaderboard-list]", ".leaderboard-table-head > span"),
    rowSchema: elementSchema(currentRow),
    detailLabels: textList("[data-leaderboard-detail]", ".leaderboard-detail-stat > span:first-child"),
    detailValues: textList("[data-leaderboard-detail]", ".leaderboard-detail-stat > strong"),
    detailSchema: elementSchema(document.querySelector("[data-leaderboard-detail]"))
  };

  const search = document.querySelector("[data-leaderboard-search]");
  search.value = "__missing_player__";
  search.dispatchEvent(new Event("input", { bubbles: true }));
  presentation.emptyState = document.querySelector("[data-leaderboard-list] .leaderboard-detail-empty")?.textContent.trim();
  presentation.emptyStateClass = document.querySelector("[data-leaderboard-list] .leaderboard-detail-empty")?.className;
  return presentation;
}

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
  window.localStorage.clear();
  delete window.__EMPIRE_GAMEPLAY_EXECUTION_MODE__;
  delete window.empireStreetsGameplaySliceReadModel;
});

describe("leaderboard presentation parity", () => {
  it("does not steal focus from search after the modal has opened", async () => {
    vi.useFakeTimers();
    const leaderboard = await renderMode("server-authoritative", createAuthoritativeReadModel());

    leaderboard.openLeaderboard();
    const searchInput = document.querySelector("[data-leaderboard-search]");
    searchInput.focus();
    vi.runOnlyPendingTimers();

    expect(document.activeElement).toBe(searchInput);
  });

  it("uses one visible schema for local demo and authoritative server data", async () => {
    await renderMode("local-demo");
    const demo = capturePresentation();

    await renderMode("server-authoritative", createAuthoritativeReadModel());
    const hosted = capturePresentation();

    expect(hosted.title).toBe("Empire score");
    expect(hosted.title).toBe(demo.title);
    expect(hosted.tabOrder).toEqual(demo.tabOrder);
    expect(hosted.tabClasses).toEqual(demo.tabClasses);
    expect(hosted.filterOrder).toEqual(demo.filterOrder);
    expect(hosted.filterClasses).toEqual(demo.filterClasses);
    expect(hosted.summaryLabels).toEqual(demo.summaryLabels);
    expect(hosted.tableHeaders).toEqual(demo.tableHeaders);
    expect(hosted.rowSchema).toEqual(demo.rowSchema);
    expect(hosted.detailLabels).toEqual(demo.detailLabels);
    expect(hosted.detailLabels).toEqual([
      "Rank",
      "Empire score",
      "Distrikty",
      "Vliv",
      "Clean",
      "Dirty",
      "Wanted",
      "Útoky",
      "Obrany",
      "Robbery",
      "Kills",
      "Ztráty",
      "Budovy",
      "Aktivita"
    ]);
    expect(hosted.detailValues.slice(4)).toEqual(Array(10).fill("—"));
    expect(demo.detailValues.slice(4)).not.toContain("—");
    expect(hosted.detailSchema).toEqual(demo.detailSchema);
    expect(hosted.emptyStateClass).toBe(demo.emptyStateClass);
    expect(hosted.emptyState).toBe(demo.emptyState);
  });

  it("fails closed without a server read model while retaining canonical slots", async () => {
    const leaderboard = await renderMode("server-authoritative");

    expect(leaderboard.getLeaderboardPlayers()).toEqual([]);
    expect(document.querySelector("[data-leaderboard-list]")?.textContent).toContain("Leaderboard se právě nepodařilo načíst.");
    expect(document.querySelector("[data-leaderboard-list]")?.textContent).not.toContain("Demo Rival");
    expect(textList("[data-leaderboard-stats]", "small")).toEqual([
      "Hráči ve výpisu",
      "Online / aktivní",
      "Empire score",
      "Police heat"
    ]);
    expect(textList("[data-leaderboard-stats]", "strong")).toEqual(["—", "—", "—", "—"]);
    expect(document.querySelector("[data-leaderboard-my-rank]")?.textContent).toContain("Mimo výpis.");
    expect(document.querySelector("[data-leaderboard-detail]")?.textContent).toContain("Vyber hráče.");
    expect(document.querySelector("[data-leaderboard-table-title]")?.textContent).toBe("Empire score");
    expect(document.querySelector("[data-leaderboard-phase]")?.textContent).toBe("LIVE / —");
  });
});
