// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SERVER_MILESTONE_IDS,
  bindServerMilestoneCards,
  createServerMilestoneFeedSnapshot,
  shouldOpenFirstPurgeCard
} from "../../page-assets/js/app/final-lockdown-popup-runtime.js";

const gameHtml = readFileSync(resolve(process.cwd(), "pages/game.html"), "utf8");
const milestoneCss = readFileSync(resolve(process.cwd(), "page-assets/css/styles-server-milestone-cards.css"), "utf8");

const mount = () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, String(value))
  };
  document.body.innerHTML = `
    <main id="game-root" data-runtime-init="ready"></main>
    <div data-server-milestone-modal hidden>
      <button data-server-milestone-close>Backdrop</button>
      <section class="server-milestone-card" tabindex="-1">
        <button data-server-milestone-close>×</button>
        <span data-server-milestone-eyebrow></span>
        <h2 data-server-milestone-title></h2>
        <div data-server-milestone-lead></div>
        <p data-server-milestone-copy></p>
        <div data-server-milestone-stats></div>
        <div data-server-milestone-ranking hidden><ol data-server-milestone-ranking-list></ol></div>
        <blockquote data-server-milestone-callout></blockquote>
        <button data-server-milestone-confirm></button>
      </section>
    </div>`;
  return bindServerMilestoneCards(document, { autoWelcome: false, storage });
};

describe("server milestone cards", () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it("keeps one shared shell without sequential progress UI", () => {
    expect(SERVER_MILESTONE_IDS).toEqual(["welcome", "first-purge", "lockdown", "winners"]);
    expect(gameHtml.match(/data-server-milestone-modal/g)).toHaveLength(1);
    expect(gameHtml).toContain("styles-server-milestone-cards.css");
    expect(gameHtml).not.toContain("data-final-lockdown-modal");
    expect(gameHtml).not.toContain("data-server-milestone-step");
  });

  it("opens four standalone cards only when their own server condition arrives", () => {
    const feedSnapshots = [];
    document.addEventListener("empire:street-news-publish", (event) => feedSnapshots.push(event.detail.snapshot));
    const controller = mount();
    const modal = document.querySelector("[data-server-milestone-modal]");
    const confirm = document.querySelector("[data-server-milestone-confirm]");

    controller.handleGameplaySlice({
      server: { serverInstanceId: "server:1" },
      mode: { tickRateMs: 5000 },
      player: { instanceId: "server:1" }
    });
    expect(modal.dataset.serverMilestone).toBe("welcome");
    expect(document.querySelector("[data-server-milestone-title]").textContent).toBe("Válka o město začíná");
    expect(document.querySelector("[data-server-milestone-eyebrow]").hidden).toBe(true);
    expect(document.querySelectorAll(".server-milestone-card__lead-paragraph")).toHaveLength(4);
    expect(confirm.textContent).toBe("Vstoupit do ulic");

    confirm.click();
    expect(modal.hidden).toBe(true);
    controller.handleGameplaySlice({
      server: { serverInstanceId: "server:1" },
      mode: { tickRateMs: 5000 },
      elimination: {
        enabled: true,
        eliminationsStopped: false,
        firstEliminationTick: 2880,
        nextEliminationTick: 2880,
        ticksUntilNextElimination: 2880,
        activePlayersRemaining: 20
      },
      player: { instanceId: "server:1" }
    });
    expect(modal.dataset.serverMilestone).toBe("first-purge");
    expect(document.querySelector("[data-server-milestone-eyebrow]").hidden).toBe(false);
    expect(document.querySelector("[data-server-milestone-lead]").textContent).toContain("4 hodiny");
    expect(confirm.textContent).toBe("Začít se připravovat");

    confirm.click();
    controller.handleGameplaySlice({
      server: { serverInstanceId: "server:1" },
      mode: { tickRateMs: 5000 },
      elimination: { activePlayersRemaining: 8 },
      player: {
        instanceId: "server:1",
        finalLockdown: { enabled: true, active: true, status: "active", leaderboardTop3: [] }
      }
    });
    expect(modal.dataset.serverMilestone).toBe("lockdown");
    expect(document.querySelector("[data-server-milestone-title]").textContent).toContain("osm hráčů");
    expect(document.querySelector("[data-server-milestone-lead]").textContent).toContain("12 hodin");
    expect(confirm.textContent).toBe("Jdu do finále");

    confirm.click();
    const ranking = [1, 2, 3].map((rank) => ({ rank, playerName: `Gang ${rank}`, score: 1000 - rank }));
    controller.handleGameplaySlice({
      server: { serverInstanceId: "server:1" },
      player: {
        instanceId: "server:1",
        finalLockdown: { enabled: true, active: false, status: "resolved", leaderboardTop3: ranking }
      }
    });
    expect(modal.dataset.serverMilestone).toBe("winners");
    expect(document.querySelectorAll("[data-server-milestone-ranking-list] li")).toHaveLength(3);
    expect(confirm.textContent).toBe("Zavřít výsledky");

    expect(feedSnapshots).toHaveLength(4);
    expect(feedSnapshots.map((entry) => entry.id)).toEqual(SERVER_MILESTONE_IDS.map((id) => `server-milestone:${id}`));
    expect(feedSnapshots.every((entry) => entry.resultKind === "server-milestone" && entry.resultPayload.openable)).toBe(true);
  });

  it("uses the canonical first-elimination countdown for the four-hour trigger", () => {
    const base = {
      mode: { tickRateMs: 5000 },
      elimination: {
        enabled: true,
        eliminationsStopped: false,
        firstEliminationTick: 3000,
        nextEliminationTick: 3000
      }
    };
    expect(shouldOpenFirstPurgeCard({
      ...base,
      elimination: { ...base.elimination, ticksUntilNextElimination: 2880 }
    })).toBe(true);
    expect(shouldOpenFirstPurgeCard({
      ...base,
      elimination: { ...base.elimination, ticksUntilNextElimination: 2881 }
    })).toBe(false);
    expect(shouldOpenFirstPurgeCard({
      ...base,
      elimination: { ...base.elimination, nextEliminationTick: 4000, ticksUntilNextElimination: 100 }
    })).toBe(false);
  });

  it("renders live server-derived countdowns for the first purge and Final Lockdown", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-21T12:00:00.000Z"));
    const controller = mount();
    const purgeSlice = {
      server: { serverInstanceId: "server:countdowns", currentTick: 100 },
      mode: { tickRateMs: 1_000 },
      elimination: {
        enabled: true, eliminationsStopped: false, firstEliminationTick: 14_500,
        nextEliminationTick: 14_500, ticksUntilNextElimination: 14_400, activePlayersRemaining: 20
      },
      player: { instanceId: "server:countdowns" }
    };
    controller.announce("welcome", "server:countdowns");
    controller.close();
    controller.handleGameplaySlice(purgeSlice);
    expect(document.querySelector('[data-server-milestone-stat="first-purge-countdown"] strong').textContent)
      .toBe("4 h 0 min 0 s");
    vi.advanceTimersByTime(1_000);
    expect(document.querySelector('[data-server-milestone-stat="first-purge-countdown"] strong').textContent)
      .toBe("3 h 59 min 59 s");

    controller.close();
    controller.handleGameplaySlice({
      server: { serverInstanceId: "server:countdowns", currentTick: 100 },
      mode: { tickRateMs: 1_000 },
      elimination: { activePlayersRemaining: 8 },
      player: {
        instanceId: "server:countdowns",
        finalLockdown: {
          enabled: true, active: true, status: "active", remainingActiveTicks: 43_200,
          endsAtEstimatedTick: 43_300, leaderboardTop3: []
        }
      }
    });
    expect(document.querySelector('[data-server-milestone-stat="final-lockdown-countdown"] strong').textContent)
      .toBe("12 h 0 min 0 s");
    vi.advanceTimersByTime(1_000);
    expect(document.querySelector('[data-server-milestone-stat="final-lockdown-countdown"] strong').textContent)
      .toBe("11 h 59 min 59 s");
  });

  it("reopens a selected card from a street news event", () => {
    const controller = mount();
    document.dispatchEvent(new CustomEvent("empire:server-milestone-open", {
      detail: { milestoneId: "first-purge" }
    }));

    expect(controller.getActiveId()).toBe("first-purge");
    expect(document.querySelector("[data-server-milestone-modal]").hidden).toBe(false);
    expect(document.querySelector("[data-server-milestone-eyebrow]").textContent).toBe("PRVNÍ OČISTA");
  });

  it("creates stable openable payloads for every announcement", () => {
    const snapshots = SERVER_MILESTONE_IDS.map((id, index) => createServerMilestoneFeedSnapshot(id, 1000 + index));
    expect(snapshots.map((entry) => entry.resultPayload.milestoneId)).toEqual(SERVER_MILESTONE_IDS);
    expect(snapshots[1].title).toBe("První Očista za 4 hodiny");
    expect(snapshots[2].summary).toContain("12 hodin");
    expect(snapshots[3].title).toContain("vítěze");
  });

  it("uses a single-scroll responsive card with reduced-motion protection", () => {
    expect(milestoneCss).toContain("max-height: min(670px");
    expect(milestoneCss).toContain("overflow: auto");
    expect(milestoneCss).toContain("@media (max-width: 680px)");
    expect(milestoneCss).toContain("@media (prefers-reduced-motion: no-preference)");
    expect(milestoneCss).not.toContain("overflow-x: auto");
  });
});
