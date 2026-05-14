import { describe, expect, it } from "vitest";
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

describe("Empire onboarding flow", () => {
  it("step registry contains every mandatory onboarding chapter", () => {
    expect(ONBOARDING_STEPS.map((step) => step.id)).toEqual([...ONBOARDING_REQUIRED_STEP_IDS]);
    expect(ONBOARDING_STEPS).toHaveLength(22);
  });

  it("every onboarding step has the required registry fields and copy", () => {
    for (const step of ONBOARDING_STEPS) {
      expect(step.title).toEqual(expect.any(String));
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.body).toEqual(expect.any(String));
      expect(step.body.length).toBeGreaterThan(0);
      expect(step).toEqual(expect.objectContaining({
        id: expect.any(String),
        placement: expect.any(String),
        completionCondition: expect.any(String),
        canSkip: expect.any(Boolean),
        highlightType: expect.any(String)
      }));
      expect(step).toHaveProperty("targetSelector");
    }
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
    const progress = skipOnboardingProgress({ currentStepId: "buildings" });

    expect(progress.completed).toBe(true);
    expect(progress.skipped).toBe(true);
    expect(progress.currentStepId).toBe("skipped");
    expect(resolveOnboardingStorageKey({ registration: { identity: "Boss" }, mode: "dev-only" }))
      .toBe("empire:onboarding:v1:dev-only:Boss");
  });

  it("serializes completed/skipped only as UI preference fields", () => {
    const serialized = serializeOnboardingProgress({
      completed: true,
      skipped: true,
      currentStepId: "skipped",
      dismissedAt: "2026-05-15T00:00:00.000Z",
      gameplayState: { dirtyCash: 999999 }
    });

    expect(Object.keys(serialized).sort()).toEqual(["completed", "currentStepId", "dismissedAt", "skipped", "version"]);
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

  it("step resolver survives missing target elements", () => {
    const readModel = createOnboardingReadModel({ world: { ownedDistrictIds: [1] } });
    const state = resolveOnboardingStepState({ id: "heat", fallbackBody: "fallback" }, readModel, createRoot());

    expect(state.status).toBe("fallback");
    expect(state.missingTarget).toBe(true);
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
    expect(state.fallback).toContain("vyplivl");
  });

  it("danger zone step uses available elimination read model data", () => {
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
    const state = resolveOnboardingStepState(ONBOARDING_STEPS.find((step) => step.id === "danger-zone"), readModel, createRoot(["[data-br-info-open]"]));

    expect(readModel.eliminationAvailable).toBe(true);
    expect(readModel.elimination.nextEliminationLabel).toBe("42 ticků");
    expect(readModel.elimination.dangerZoneLabel).toBe("1 hráčů v danger zone");
    expect(state.status).toBe("ready");
  });

  it("day/night step uses the day/night read model when it exists", () => {
    const readModel = createOnboardingReadModel({
      dayNight: { phase: "night" },
      world: { ownedDistrictIds: [1] }
    });
    const state = resolveOnboardingStepState(ONBOARDING_STEPS.find((step) => step.id === "day-night"), readModel, createRoot([".map-phase-toolbar"]));

    expect(readModel.dayNightAvailable).toBe(true);
    expect(state.status).toBe("ready");
  });
});
