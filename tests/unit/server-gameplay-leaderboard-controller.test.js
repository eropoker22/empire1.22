// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createServerGameplayLeaderboardController
} from "../../page-assets/js/app/ui/serverGameplayLeaderboardController.js";
import {
  createServerGameplayLeaderboardViewModel
} from "../../page-assets/js/app/ui/serverGameplayLeaderboardViewModel.js";

describe("server gameplay leaderboard controller", () => {
  beforeEach(() => {
    document.body.innerHTML = createFixture();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("uses only the authoritative read model and renders missing data neutrally", () => {
    const paths = [
      "../../page-assets/js/app/ui/serverGameplayLeaderboardController.js",
      "../../page-assets/js/app/ui/serverGameplayLeaderboardElements.js",
      "../../page-assets/js/app/ui/serverGameplayLeaderboardViewModel.js",
      "../../page-assets/js/app/ui/serverGameplayLeaderboardView.js"
    ];
    const source = paths.map((path) => readFileSync(new URL(path, import.meta.url), "utf8")).join("\n");
    expect(source).not.toMatch(/dev-fixtures|features\/leaderboard|localStorage|runtime\.js/u);

    const unavailable = createServerGameplayLeaderboardViewModel(null);
    expect(unavailable.status).toBe("unavailable");
    expect(unavailable.entries).toEqual([]);

    const authoritative = createServerGameplayLeaderboardViewModel(createReadModel());
    expect(authoritative.entries.map((entry) => entry.name)).toEqual(["Aster", "Nyx"]);
    expect(authoritative.currentPlayer?.playerId).toBe("player:1");
  });

  it("mounts once, subscribes once, and skips equal server snapshots", () => {
    const source = createSource(createReadModel());
    const controller = createController(source);
    expect(controller.mount()).toBe(true);
    expect(controller.mount()).toBe(false);
    expect(source.subscribe).toHaveBeenCalledTimes(1);

    document.querySelector("[data-leaderboard-popup-open]").click();
    expect(controller.getDiagnostics().renders).toBe(1);
    expect(document.querySelectorAll("[data-leaderboard-player-id]")).toHaveLength(2);

    const cashOnlyChange = structuredClone(createReadModel());
    cashOnlyChange.player.economy.cleanCash = 90_000;
    source.emit(cashOnlyChange);
    expect(controller.getDiagnostics().renders).toBe(1);

    const changed = structuredClone(createReadModel());
    changed.leaderboard.entries[1].score = 950;
    source.emit(changed);
    expect(controller.getDiagnostics().renders).toBe(2);

    expect(controller.destroy()).toBe(true);
    expect(controller.destroy()).toBe(false);
    expect(source.unsubscribe).toHaveBeenCalledTimes(1);
    document.querySelector("[data-leaderboard-popup-open]").click();
    expect(document.querySelector("[data-leaderboard-popup]").hidden).toBe(true);
  });

  it("filters server rows and keeps unsupported tabs unavailable", () => {
    const controller = createController();
    controller.mount();
    controller.update(createReadModel());
    controller.open();

    const unsupportedTab = document.querySelector('[data-leaderboard-tab="money"]');
    expect(unsupportedTab.disabled).toBe(true);
    expect(unsupportedTab.getAttribute("aria-disabled")).toBe("true");

    const search = document.querySelector("[data-leaderboard-search]");
    search.value = "nyx";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    const rows = [...document.querySelectorAll("[data-leaderboard-player-id]")];
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain("Nyx");
    expect(rows[0].textContent).not.toContain("Aster");
    controller.destroy();
  });

  it("opens the selected server player and forwards bounty targeting as presentation intent", () => {
    const controller = createController();
    const bountyEvent = vi.fn();
    document.addEventListener("empire:open-bounty-modal", bountyEvent, { once: true });
    controller.mount();
    controller.update(createReadModel());
    controller.open();

    document.querySelector('[data-leaderboard-action="view"][data-player-id="player:2"]').click();
    expect(document.querySelector("[data-leaderboard-player-detail]").hidden).toBe(false);
    expect(document.querySelector("[data-leaderboard-detail]").textContent).toContain("Nyx");
    document.querySelector('[data-leaderboard-action="bounty"][data-player-id="player:2"]').click();

    expect(document.querySelector("[data-leaderboard-popup]").hidden).toBe(true);
    expect(bountyEvent).toHaveBeenCalledTimes(1);
    expect(bountyEvent.mock.calls[0][0].detail).toEqual({
      source: "leaderboard",
      targetPlayerId: "player:2"
    });
    controller.destroy();
  });

  it("cleans source, listeners, overlays, and toast timers on pagehide", () => {
    const source = createSource(createReadModel());
    const controller = createController(source);
    controller.mount();
    controller.open();
    document.querySelector('[data-leaderboard-tab="alliance"]').click();
    document.querySelector('[data-leaderboard-action="view-alliance"]').click();
    expect(controller.getDiagnostics().timerActive).toBe(true);

    window.dispatchEvent(new Event("pagehide"));
    expect(controller.getDiagnostics()).toMatchObject({
      mounted: false,
      open: false,
      timerActive: false
    });
    expect(source.unsubscribe).toHaveBeenCalledTimes(1);
  });
});

function createController(source = null) {
  return createServerGameplayLeaderboardController({
    root: document.querySelector("#game-root"),
    source,
    documentRef: document,
    windowRef: window
  });
}

function createSource(readModel) {
  let listener = null;
  const unsubscribe = vi.fn();
  return {
    subscribe: vi.fn((nextListener) => {
      listener = nextListener;
      return unsubscribe;
    }),
    getCurrentReadModel: vi.fn(() => readModel),
    unsubscribe,
    emit: (nextReadModel) => listener?.(nextReadModel)
  };
}

function createReadModel() {
  return {
    server: { serverInstanceId: "free:bratislava:1" },
    mode: { mode: "free" },
    player: {
      playerId: "player:1",
      economy: { cleanCash: 5000 }
    },
    leaderboard: {
      generatedAt: "2026-07-26T12:00:00.000Z",
      entries: [
        {
          rank: 1,
          playerId: "player:1",
          name: "Aster",
          factionId: "north",
          allianceTag: "RED",
          controlledDistricts: 8,
          influence: 200,
          score: 1000,
          status: "active",
          movement: 1,
          isCurrentPlayer: true
        },
        {
          rank: 2,
          playerId: "player:2",
          name: "Nyx",
          factionId: "south",
          allianceTag: "BLU",
          controlledDistricts: 6,
          influence: 180,
          score: 900,
          status: "active",
          movement: 0,
          isCurrentPlayer: false
        }
      ],
      currentPlayer: {
        rank: 1,
        playerId: "player:1",
        name: "Aster",
        factionId: "north",
        allianceTag: "RED",
        controlledDistricts: 8,
        influence: 200,
        score: 1000,
        status: "active",
        movement: 1,
        isCurrentPlayer: true
      }
    }
  };
}

function createFixture() {
  return `<main id="game-root">
    <button data-leaderboard-popup-open>Leaderboard</button>
    <div data-leaderboard-popup hidden>
      <div data-leaderboard-popup-close></div>
      <section class="leaderboard-popup-card" tabindex="-1">
        <button data-leaderboard-popup-close>Zavřít</button>
        <span data-leaderboard-server-badge></span>
        <strong data-leaderboard-phase></strong>
        <input data-leaderboard-search>
        <button data-leaderboard-filter="current">Current</button>
        <button data-leaderboard-filter="alliance">Alliance</button>
        <button data-leaderboard-tab="overall">Overall</button>
        <button data-leaderboard-tab="money">Money</button>
        <button data-leaderboard-tab="alliance">Alliance</button>
        <aside data-leaderboard-my-rank></aside>
        <span data-leaderboard-mode-label></span>
        <h4 data-leaderboard-table-title></h4>
        <span data-leaderboard-count></span>
        <div data-leaderboard-stats></div>
        <div data-leaderboard-list></div>
        <div data-leaderboard-player-detail hidden>
          <button data-leaderboard-player-detail-close>Close detail</button>
          <section class="leaderboard-player-detail-card" tabindex="-1">
            <div data-leaderboard-detail></div>
          </section>
        </div>
        <div data-leaderboard-toast hidden>
          <strong data-leaderboard-toast-title></strong>
          <span data-leaderboard-toast-message></span>
        </div>
      </section>
    </div>
  </main>`;
}
