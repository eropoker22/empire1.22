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

const mount = (executionMode = "server-authoritative", onboardingStatus = "completed") => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, String(value))
  };
  document.documentElement.dataset.onboardingStatus = onboardingStatus;
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
  return bindServerMilestoneCards(document, {
    autoWelcome: false,
    storage,
    getExecutionMode: () => executionMode
  });
};

describe("server milestone cards", () => {
  afterEach(() => {
    vi.useRealTimers();
    delete document.documentElement.dataset.onboardingStatus;
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
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-21T12:00:00.000Z"));
    const feedSnapshots = [];
    document.addEventListener("empire:street-news-publish", (event) => feedSnapshots.push(event.detail.snapshot));
    const controller = mount();
    const modal = document.querySelector("[data-server-milestone-modal]");
    const confirm = document.querySelector("[data-server-milestone-confirm]");

    controller.handleGameplaySlice({
      server: { serverInstanceId: "server:1", status: "running", generatedAt: "2026-07-21T12:00:00.000Z" },
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
      server: {
        serverInstanceId: "server:1",
        status: "running",
        currentTick: 100,
        generatedAt: "2026-07-21T12:00:00.000Z"
      },
      mode: { tickRateMs: 5000 },
      elimination: {
        enabled: true,
        eliminationsStopped: false,
        firstEliminationTick: 2980,
        nextEliminationTick: 2980,
        ticksUntilNextElimination: 2880,
        activePlayersRemaining: 20
      },
      player: { instanceId: "server:1" }
    });
    expect(modal.dataset.serverMilestone).toBe("first-purge");
    expect(document.querySelector("[data-server-milestone-eyebrow]").hidden).toBe(false);
    expect(document.querySelector("[data-server-milestone-lead]").textContent).toContain("skutečný serverový odpočet");
    expect(confirm.textContent).toBe("Začít se připravovat");

    confirm.click();
    controller.handleGameplaySlice({
      server: { serverInstanceId: "server:1", status: "running", generatedAt: "2026-07-21T12:00:00.000Z" },
      mode: { tickRateMs: 5000 },
      elimination: { activePlayersRemaining: 8 },
      player: {
        instanceId: "server:1",
        finalLockdown: { enabled: true, active: true, status: "active", leaderboardTop3: [] }
      }
    });
    expect(modal.dataset.serverMilestone).toBe("lockdown");
    expect(document.querySelector("[data-server-milestone-title]").textContent).toContain("závěrečné fáze");
    expect(document.querySelector("[data-server-milestone-lead]").textContent).toContain("serverový odpočet");
    expect(confirm.textContent).toBe("Jdu do finále");

    confirm.click();
    const ranking = [1, 2, 3].map((rank) => ({ rank, playerName: `Gang ${rank}`, score: 1000 - rank }));
    controller.handleGameplaySlice({
      server: { serverInstanceId: "server:1", status: "ended" },
      player: {
        instanceId: "server:1",
        finalLockdown: { enabled: true, active: false, status: "resolved", leaderboardTop3: ranking }
      }
    });
    expect(modal.dataset.serverMilestone).toBe("winners");
    expect(document.querySelectorAll("[data-server-milestone-ranking-list] li")).toHaveLength(3);
    expect(confirm.textContent).toBe("Zavřít výsledky");

    expect(feedSnapshots).toHaveLength(4);
    expect(feedSnapshots.map((entry) => entry.id)).toEqual([
      "server-milestone:welcome",
      "server-milestone:first-purge:2980:240m",
      "server-milestone:lockdown",
      "server-milestone:winners"
    ]);
    expect(feedSnapshots.every((entry) => entry.resultKind === "server-milestone" && entry.resultPayload.openable)).toBe(true);
  });

  it("never opens a server lifecycle milestone in local demo mode", () => {
    const controller = mount("local-demo");
    const modal = document.querySelector("[data-server-milestone-modal]");
    const gameplaySlice = {
      server: { serverInstanceId: "server:forged-demo" },
      player: { instanceId: "server:forged-demo" }
    };

    expect(controller.handleGameplaySlice(gameplaySlice)).toBe(false);
    expect(controller.open("welcome")).toBe(false);
    document.dispatchEvent(new CustomEvent("empire:server-milestone-open", {
      detail: { milestoneId: "welcome" }
    }));

    expect(modal.hidden).toBe(true);
    expect(controller.getActiveId()).toBe("");
  });

  it("defers the server welcome card until onboarding is completed or skipped", () => {
    const controller = mount("server-authoritative", "pending");
    const modal = document.querySelector("[data-server-milestone-modal]");
    const gameplaySlice = {
      server: { serverInstanceId: "server:onboarding-order", status: "running" },
      player: { instanceId: "server:onboarding-order" }
    };

    expect(controller.handleGameplaySlice(gameplaySlice)).toBe(false);
    expect(modal.hidden).toBe(true);

    document.dispatchEvent(new CustomEvent("empire:onboarding-state-change", {
      detail: { status: "completed", progress: { completed: true, skipped: true } }
    }));

    expect(modal.hidden).toBe(false);
    expect(modal.dataset.serverMilestone).toBe("welcome");
  });

  it("does not show the welcome card before the admin starts the server", () => {
    const controller = mount();
    const modal = document.querySelector("[data-server-milestone-modal]");

    expect(controller.handleGameplaySlice({
      server: { serverInstanceId: "server:waiting", status: "lobby" },
      player: { instanceId: "server:waiting" }
    })).toBe(false);
    expect(modal.hidden).toBe(true);

    expect(controller.handleGameplaySlice({
      server: { serverInstanceId: "server:waiting", status: "running" },
      player: { instanceId: "server:waiting" }
    })).toBe(true);
    expect(modal.dataset.serverMilestone).toBe("welcome");
  });

  it("uses the canonical elimination countdown for the four-hour trigger on every purge cycle", () => {
    const generatedAt = "2026-07-21T12:00:00.000Z";
    const base = {
      server: { currentTick: 120, generatedAt },
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
    }, Date.parse(generatedAt))).toBe(true);
    expect(shouldOpenFirstPurgeCard({
      ...base,
      server: { currentTick: 119, generatedAt },
      elimination: { ...base.elimination, ticksUntilNextElimination: 2881 }
    }, Date.parse(generatedAt))).toBe(false);
    expect(shouldOpenFirstPurgeCard({
      ...base,
      server: { currentTick: 1120, generatedAt },
      elimination: { ...base.elimination, nextEliminationTick: 4000, ticksUntilNextElimination: 2880 }
    }, Date.parse(generatedAt))).toBe(true);
  });

  it("opens the red glass card at all five authoritative Očista milestones and publishes each to Street News", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-21T12:00:00.000Z"));
    const feedSnapshots = [];
    document.addEventListener("empire:street-news-publish", (event) => feedSnapshots.push(event.detail.snapshot));
    const controller = mount();
    const deadlineTick = 28_800;

    controller.announce("welcome", "server:purge-milestones");
    controller.close();

    const remainingSeconds = [28_740, 14_400, 3_600, 900, 300];
    for (const seconds of remainingSeconds) {
      controller.handleGameplaySlice({
        server: {
          serverInstanceId: "server:purge-milestones",
          status: "running",
          currentTick: deadlineTick - seconds,
          generatedAt: "2026-07-21T12:00:00.000Z"
        },
        mode: { tickRateMs: 1_000 },
        elimination: {
          enabled: true,
          eliminationsStopped: false,
          firstEliminationTick: deadlineTick,
          nextEliminationTick: deadlineTick,
          ticksUntilNextElimination: seconds,
          activePlayersRemaining: 20
        },
        player: { instanceId: "server:purge-milestones" }
      });
      expect(controller.getActiveId(), `remaining seconds: ${seconds}`).toBe("first-purge");
      expect(document.querySelector("[data-server-milestone-title]").textContent).toBe("Město začalo odpočítávat");
      controller.close();
      expect(document.querySelector("[data-server-milestone-modal]").hidden, `closed at: ${seconds}`).toBe(true);
    }

    const purgeFeed = feedSnapshots.filter((entry) => entry.resultPayload.milestoneId === "first-purge");
    expect(purgeFeed).toHaveLength(5);
    expect(purgeFeed.map((entry) => entry.id)).toEqual([
      "server-milestone:first-purge:28800:479m",
      "server-milestone:first-purge:28800:240m",
      "server-milestone:first-purge:28800:60m",
      "server-milestone:first-purge:28800:15m",
      "server-milestone:first-purge:28800:5m"
    ]);
    expect(purgeFeed.every((entry) => entry.resultPayload.openable)).toBe(true);
  });

  it("renders live server-derived countdowns for the first purge and Final Lockdown", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-21T12:00:00.000Z"));
    const controller = mount();
    const purgeSlice = {
      server: {
        serverInstanceId: "server:countdowns",
        status: "running",
        currentTick: 100,
        generatedAt: "2026-07-21T12:00:00.000Z"
      },
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
      server: {
        serverInstanceId: "server:countdowns",
        status: "running",
        currentTick: 100,
        generatedAt: "2026-07-21T12:00:00.000Z"
      },
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
    expect(document.querySelector("[data-server-milestone-eyebrow]").textContent).toBe("OČISTA SE BLÍŽÍ");
  });

  it("creates stable openable payloads for every announcement", () => {
    const snapshots = SERVER_MILESTONE_IDS.map((id, index) => createServerMilestoneFeedSnapshot(id, 1000 + index));
    expect(snapshots.map((entry) => entry.resultPayload.milestoneId)).toEqual(SERVER_MILESTONE_IDS);
    expect(snapshots[1].title).toBe("Očista se blíží");
    expect(snapshots[2].summary).toBe("Závěrečná fáze války právě začala.");
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
