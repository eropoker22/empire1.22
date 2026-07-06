import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
import {
  createOnboardingReadModel,
  resolveOnboardingStepState
} from "../../page-assets/js/app/runtime/onboardingReadModel.js";
import {
  resolveOnboardingStorageKey,
  serializeOnboardingProgress,
  skipOnboardingProgress,
  updateOnboardingProgress
} from "../../page-assets/js/app/runtime/onboardingBridge.js";
import {
  ONBOARDING_REQUIRED_STEP_IDS,
  ONBOARDING_STEPS
} from "../../page-assets/js/app/runtime/onboardingStepRegistry.js";
import {
  normalizeOnboardingProgress,
  renderOnboardingPanel,
  shouldAutoStartOnboarding
} from "../../page-assets/js/app/ui/onboardingPanel.js";

function createRoot(foundSelectors = []) {
  const selectors = new Set(foundSelectors);
  return {
    querySelector(selector) {
      return String(selector || "")
        .split(",")
        .map((item) => item.trim())
        .some((item) => selectors.has(item))
        ? { getBoundingClientRect: () => ({ left: 1, top: 2, width: 30, height: 40 }) }
        : null;
    }
  };
}

function createOnboardingDom() {
  const dom = new JSDOM(`<!doctype html><body>
    <main id="game-root">
      <canvas data-map-canvas></canvas>
      <button data-building-action-building-id="b1" data-building-action-id="collect"></button>
      <button data-gang-heat></button>
      <button data-district-action-id="spy"></button>
      <button data-district-action-id="attack"></button>
    </main>
  </body>`);
  const { document } = dom.window;
  for (const element of document.querySelectorAll("*")) {
    element.getBoundingClientRect = () => ({ left: 24, top: 32, width: 120, height: 44, right: 144, bottom: 76 });
    element.scrollIntoView = () => {};
  }
  return {
    document,
    root: document.getElementById("game-root"),
    mount: document.createElement("section")
  };
}

function collectText(element) {
  return String(element?.textContent || "").replace(/\s+/gu, " ").trim();
}

describe("Empire onboarding flow", () => {
  it("step registry contains every mandatory onboarding chapter", () => {
    expect(ONBOARDING_STEPS.map((step) => step.id)).toEqual([...ONBOARDING_REQUIRED_STEP_IDS]);
    expect(ONBOARDING_STEPS).toHaveLength(7);
    expect(ONBOARDING_STEPS.map(({ title, body, cta }) => ({ title, body, cta }))).toEqual([
      { title: "Vítej v ulicích", body: "Město svítí, ale nikomu neodpouští.", cta: "Začít" },
      { title: "Otevři district", body: "Tady začíná tvoje území.", cta: "Ukázat" },
      { title: "Spusť akci", body: "Budovy vydělávají, když je rozhýbeš.", cta: "Rozumím" },
      { title: "Sleduj heat", body: "Čím víc riskuješ, tím víc tě řeší policie.", cta: "Rozumím" },
      { title: "Pošli špehy", body: "Špehování běží v čase. Počkej na návrat.", cta: "Rozumím" },
      { title: "Zadej rozkaz", body: "Útok není kliknutí. Je to rozkaz do ulic.", cta: "Rozumím" },
      { title: "Hotovo", body: "Základ znáš. Teď rozšiř vliv.", cta: "Pokračovat" }
    ]);
    expect(ONBOARDING_STEPS.find((step) => step.id === "building-action")?.completionCondition).toBe("building-action:feedback");
  });

  it("every onboarding step has the required registry fields and compact player-facing copy", () => {
    const forbiddenCopy = /server-authoritative|runtime|localStorage|slice|selector|started|confirm dialog/i;
    for (const step of ONBOARDING_STEPS) {
      expect(step.title).toEqual(expect.any(String));
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.title.length).toBeLessThanOrEqual(24);
      expect(step.body).toEqual(expect.any(String));
      expect(step.body.length).toBeGreaterThan(0);
      expect(step.body.length).toBeLessThanOrEqual(58);
      expect(step.body.split(/[.!?]+/u).filter((part) => part.trim()).length).toBeLessThanOrEqual(2);
      expect(step).toEqual(expect.objectContaining({
        id: expect.any(String),
        phase: expect.any(String),
        badge: expect.any(String),
        kind: expect.any(String),
        placement: expect.any(String),
        completionCondition: expect.any(String),
        canSkip: expect.any(Boolean),
        highlightType: expect.any(String)
      }));
      expect(step.subtitle ?? "").toEqual(expect.any(String));
      expect(step).toHaveProperty("targetSelector");
      expect(step.phase.length).toBeGreaterThan(0);
      expect(step.badge.length).toBeGreaterThan(0);
      expect(["dirty", "objective", "map", "intel", "money", "resource", "danger", "system"]).toContain(step.kind);
      expect([step.title, step.subtitle, step.body, step.fallbackTitle, step.fallbackBody, step.task, ...(step.summaryItems || [])].join(" "))
        .not.toMatch(forbiddenCopy);
      if (step.fallbackBody) {
        expect(step.fallbackBody.length).toBeLessThanOrEqual(80);
      }
    }

    const done = ONBOARDING_STEPS.find((step) => step.id === "done");
    expect(done?.summaryItems || []).toHaveLength(0);
  });

  it("renders progress, CTA, skip and a compact game UI panel for every onboarding step", () => {
    for (const [index, step] of ONBOARDING_STEPS.entries()) {
      const { document, root, mount } = createOnboardingDom();
      root.append(mount);

      expect(renderOnboardingPanel({ currentStepId: step.id }, {}, { mount, root, readModel: {} })).toBe(true);

      const text = collectText(mount);
      expect(text).toContain(`Krok ${index + 1} / ${ONBOARDING_STEPS.length}`);
      expect(text).toContain(step.title);
      expect(mount.querySelector("[data-onboarding-primary-action]")).toBeTruthy();
      expect(mount.querySelector("[data-onboarding-primary-action]")?.textContent).toBe(step.cta || "Další");
      expect([...mount.querySelectorAll("button")].some((button) => button.textContent === "Přeskočit")).toBe(true);
      expect(mount.querySelector(".empire-onboarding__signal")).toBeTruthy();
      expect(mount.querySelector(".empire-onboarding__badge-row")).toBeNull();
      expect(mount.querySelector(".empire-onboarding__status-chip")).toBeNull();
      expect(mount.querySelector(".empire-onboarding__task")).toBeNull();
      expect(document.querySelector("[data-onboarding-highlight]")).toBeTruthy();
      if (step.completionCondition === "manual") {
        expect(mount.querySelector("[data-onboarding-primary-action]")?.dataset.onboardingPrimaryMode).toBe("complete");
      } else {
        expect(mount.querySelector("[data-onboarding-primary-action]")?.dataset.onboardingPrimaryMode).toBe("guide");
      }
    }
  });

  it("does not let the panel CTA complete runtime-gated onboarding steps", () => {
    const { root, mount } = createOnboardingDom();
    const onNext = vi.fn();
    root.append(mount);

    expect(renderOnboardingPanel({ currentStepId: "building-action" }, { onNext }, { mount, root, readModel: {} })).toBe(true);
    mount.querySelector("[data-onboarding-primary-action]")?.click();

    expect(onNext).not.toHaveBeenCalled();
  });

  it("finds the first owned district in the dev-only read model", () => {
    const readModel = createOnboardingReadModel({
      registration: { identity: "Operator" },
      mode: "dev-only",
      world: { ownedDistrictIds: [27] },
      districts: [
        { id: 12, adjacentDistrictIds: [27] },
        { id: 27, adjacentDistrictIds: [28] },
        { id: 28, adjacentDistrictIds: [27] }
      ]
    });

    expect(readModel.playerId).toBe("Operator");
    expect(readModel.playerStatus).toBe("active");
    expect(readModel.hasOwnedDistrict).toBe(true);
    expect(readModel.firstOwnedDistrictId).toBe("27");
    expect(readModel.suggestedNeighborDistrictId).toBe("28");
  });

  it("returns a safe fallback when the player has no district", () => {
    const readModel = createOnboardingReadModel({
      world: { ownedDistrictIds: [] },
      districts: [{ id: 4, adjacentDistrictIds: [5] }]
    });

    expect(readModel.hasOwnedDistrict).toBe(false);
    expect(readModel.firstOwnedDistrictId).toBeNull();
    expect(readModel.hasNeighborDistricts).toBe(false);
  });

  it("does not auto-start completed onboarding", () => {
    const readModel = createOnboardingReadModel({ world: { ownedDistrictIds: [1] } });
    const progress = normalizeOnboardingProgress({ completed: true, currentStepId: "completed" });

    expect(shouldAutoStartOnboarding(progress, readModel)).toBe(false);
  });

  it("skip stores the UI state as completed with a skipped current step", () => {
    for (const stepId of ONBOARDING_REQUIRED_STEP_IDS) {
      const progress = skipOnboardingProgress({ currentStepId: stepId });
      expect(progress.completed).toBe(true);
      expect(progress.skipped).toBe(true);
      expect(progress.currentStepId).toBe("skipped");
    }
    expect(resolveOnboardingStorageKey({ registration: { identity: "Boss" }, mode: "dev-only" }))
      .toBe("empire:onboarding:demo-v1:dev-only:Boss");
  });

  it("serializes completed/skipped only as UI preference fields", () => {
    const serialized = serializeOnboardingProgress({
      completed: true,
      skipped: true,
      currentStepId: "skipped",
      dismissedAt: "2026-05-15T00:00:00.000Z",
      gameplayState: { dirtyCash: 999999 }
    });

    expect(Object.keys(serialized).sort()).toEqual(["completed", "currentStepId", "dismissedAt", "observedStepIds", "skipped", "version"]);
    expect(serialized).not.toHaveProperty("gameplayState");
  });

  it("does not mutate gameplay state while resolving onboarding progress", () => {
    const gameplayState = {
      world: { ownedDistrictIds: [1] },
      progress: { currentStepId: "your-district" }
    };
    const before = JSON.stringify(gameplayState);

    updateOnboardingProgress(gameplayState, { type: "district:own-opened", detail: { district: { id: 1 } } });
    createOnboardingReadModel(gameplayState);

    expect(JSON.stringify(gameplayState)).toBe(before);
  });

  it("records out-of-order demo events without jumping straight to later steps", () => {
    let progress = updateOnboardingProgress({
      world: { ownedDistrictIds: [1] },
      progress: { currentStepId: "welcome" }
    }, {
      type: "spy:started",
      detail: { targetDistrictId: 2 }
    });

    expect(progress.currentStepId).toBe("building-action");
    expect(progress.completedStepIds).toEqual(["welcome", "your-district"]);
    expect(progress.observedStepIds).toEqual(expect.arrayContaining(["welcome", "your-district", "spy"]));
    expect(progress.completedStepIds).not.toContain("spy");

    progress = updateOnboardingProgress({
      world: { ownedDistrictIds: [1] },
      progress
    }, {
      type: "district:own-opened",
      detail: { district: { id: 1 } }
    });

    expect(progress.currentStepId).toBe("building-action");
    expect(progress.completedStepIds).toEqual(["welcome", "your-district"]);
    expect(progress.completedStepIds).not.toContain("spy");
  });

  it("does not complete Welcome from passive boot police feedback", () => {
    const progress = updateOnboardingProgress({
      world: { ownedDistrictIds: [1] },
      progress: { currentStepId: "welcome" }
    }, {
      type: "police:feedback",
      detail: { heat: 35, message: "initial render" }
    });

    expect(progress.currentStepId).toBe("welcome");
    expect(progress.completedStepIds).toEqual([]);
    expect(progress.observedStepIds).toEqual(["heat-police"]);
  });

  it("remembers confirmed building feedback done before the district step catches up", () => {
    let progress = updateOnboardingProgress({
      world: { ownedDistrictIds: [1] },
      progress: { currentStepId: "welcome" }
    }, {
      type: "building-action:feedback",
      detail: {
        payload: {
          actionId: "sell_drugs",
          buildingTypeId: "street_dealers"
        }
      }
    });

    expect(progress.currentStepId).toBe("heat-police");
    expect(progress.completedStepIds).toEqual(["welcome", "your-district", "building-action"]);

    progress = updateOnboardingProgress({
      world: { ownedDistrictIds: [1] },
      progress
    }, {
      type: "attack:started",
      detail: { targetDistrictId: 2 }
    });

    expect(progress.currentStepId).toBe("heat-police");
    expect(progress.completedStepIds).not.toContain("attack-order");
  });

  it("does not complete the building action step until confirmed feedback is visible", () => {
    let progress = normalizeOnboardingProgress({ currentStepId: "building-action" });

    progress = updateOnboardingProgress({
      world: { ownedDistrictIds: [1] },
      progress
    }, {
      type: "building:opened",
      detail: { buildingName: "Pouliční dealeři" }
    });

    expect(progress.currentStepId).toBe("building-action");
    expect(progress.completedStepIds).not.toContain("building-action");

    progress = updateOnboardingProgress({
      world: { ownedDistrictIds: [1] },
      progress
    }, {
      type: "building-action:feedback",
      detail: {
        payload: {
          actionId: "sell_drugs",
          buildingTypeId: "street_dealers"
        }
      }
    });

    expect(progress.currentStepId).toBe("heat-police");
    expect(progress.completedStepIds).toContain("building-action");
  });

  it("uses async started states for spy and attack onboarding progress", () => {
    let progress = normalizeOnboardingProgress({ currentStepId: "spy" });

    progress = updateOnboardingProgress({
      world: { ownedDistrictIds: [1] },
      progress
    }, {
      type: "spy:opened",
      detail: { targetDistrictId: 2 }
    });

    expect(progress.currentStepId).toBe("spy");

    progress = updateOnboardingProgress({
      world: { ownedDistrictIds: [1] },
      progress
    }, {
      type: "spy:started",
      detail: { targetDistrictId: 2, mission: { returnAt: "2026-05-15T01:00:00.000Z" } }
    });

    expect(progress.currentStepId).toBe("attack-order");
    expect(progress.completedStepIds).toContain("spy");

    progress = updateOnboardingProgress({
      world: { ownedDistrictIds: [1] },
      progress
    }, {
      type: "attack:opened",
      detail: { targetDistrictId: 2 }
    });

    expect(progress.currentStepId).toBe("attack-order");

    progress = updateOnboardingProgress({
      world: { ownedDistrictIds: [1] },
      progress
    }, {
      type: "attack:started",
      detail: { targetDistrictId: 2, order: { resolveAt: "2026-05-15T01:30:00.000Z" } }
    });

    expect(progress.currentStepId).toBe("done");
    expect(progress.completedStepIds).toContain("attack-order");
  });

  it("step resolver survives missing target elements", () => {
    const readModel = createOnboardingReadModel({ world: { ownedDistrictIds: [1] } });
    const state = resolveOnboardingStepState({ id: "heat-police", fallbackBody: "fallback" }, readModel, createRoot());

    expect(state.status).toBe("fallback");
    expect(state.missingTarget).toBe(true);
    expect(state.fallbackTitle).toBe("Cíl teď není dostupný.");
    expect(state.fallback).toBe("fallback");
  });

  it("defeated players see defeated state instead of the normal flow", () => {
    const readModel = createOnboardingReadModel({
      currentPlayerStatus: "defeated",
      world: { ownedDistrictIds: [1] }
    });
    const state = resolveOnboardingStepState({ id: "welcome" }, readModel, createRoot(["[data-gang-heat]"]));

    expect(readModel.playerStatus).toBe("defeated");
    expect(state.status).toBe("defeated");
    expect(state.fallback).toContain("vyřazený");
  });

  it("operator read model still exposes elimination data without making it onboarding v1 scope", () => {
    const readModel = createOnboardingReadModel({
      elimination: {
        enabled: true,
        ticksUntilNextElimination: 42,
        dangerZone: [{ playerId: "p1" }],
        currentPlayerStatus: "danger",
        activePlayersRemaining: 12
      },
      world: { ownedDistrictIds: [1] }
    });

    expect(readModel.eliminationAvailable).toBe(true);
    expect(readModel.elimination.nextEliminationLabel).toBe("za 42m");
    expect(readModel.elimination.dangerZoneLabel).toBe("1 hráčů v danger zone");
    expect(readModel.elimination.maxPlayersPerServer).toBe(20);
    expect(ONBOARDING_STEPS.some((step) => step.id === "elimination-danger")).toBe(false);
  });

  it("operator read model exposes final lockdown essentials", () => {
    const readModel = createOnboardingReadModel({
      player: {
        finalLockdown: {
          enabled: true,
          active: true,
          remainingActiveTicks: 462,
          currentPlayerRank: 4,
          currentPlayerFinalScore: 12000,
          leaderboardTop3: [{ score: 51000 }, { score: 50000 }, { score: 49000 }],
          topRankCount: 3
        }
      },
      world: { ownedDistrictIds: [1] }
    });

    expect(readModel.finalLockdown).toMatchObject({
      active: true,
      remainingLabel: "7h 42m zbývá",
      rankLabel: "#4",
      top3Gap: "+37k"
    });
  });

  it("day/night data remains available without being a hard onboarding v1 step", () => {
    const readModel = createOnboardingReadModel({
      dayNight: { phase: "night" },
      world: { ownedDistrictIds: [1] }
    });

    expect(readModel.dayNightAvailable).toBe(true);
    expect(ONBOARDING_STEPS.some((step) => step.id === "day-night")).toBe(false);
  });
});
