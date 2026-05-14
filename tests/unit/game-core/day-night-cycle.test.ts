import { describe, expect, it } from "vitest";
import {
  applyDayNightBuildingIncomeModifiers,
  applyDayNightHeistDetectionChance,
  calculatePlayerPolicePressure,
  createDayNightReadModel,
  createPlayerView,
  getCurrentDayNightPhase,
  runTick
} from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import { createCoreStateFixture } from "../../fixtures/game-state-fixtures";

const createContext = (mode: "free" | "war" = "free") => {
  const config = resolveModeConfig(mode);
  return {
    config: {
      ...config,
      balance: {
        ...config.balance,
        policePressureMultiplier: 1
      }
    }
  };
};

describe("day night cycle", () => {
  it("calculates free mode day and night phases from ticks", () => {
    const state = createCoreStateFixture();
    const context = createContext("free");

    state.root.tick = 0;
    expect(getCurrentDayNightPhase(state, context)).toMatchObject({
      phaseId: "day",
      startedAtTick: 0,
      endsAtTick: 240,
      remainingTicks: 240
    });

    state.root.tick = 240;
    expect(getCurrentDayNightPhase(state, context)).toMatchObject({
      phaseId: "night",
      startedAtTick: 240,
      endsAtTick: 480,
      remainingTicks: 240
    });
  });

  it("calculates war mode duration from config", () => {
    const state = createCoreStateFixture();
    const context = createContext("war");
    state.root.tick = 959;

    expect(getCurrentDayNightPhase(state, context)).toMatchObject({
      phaseId: "day",
      endsAtTick: 960,
      remainingTicks: 1
    });

    state.root.tick = 960;
    expect(getCurrentDayNightPhase(state, context)).toMatchObject({
      phaseId: "night",
      startedAtTick: 960,
      endsAtTick: 1920
    });
  });

  it("emits city feed when the phase changes", () => {
    const state = createCoreStateFixture();
    const context = createContext("free");
    state.root.tick = 239;
    state.serverInstance.currentTick = 239;

    const result = runTick(state, context);
    const feed = Object.values(result.nextState.cityFeedEventsById);

    expect(feed.some((event) =>
      event.sourceType === "system"
      && event.category === "system"
      && event.truthiness === "confirmed"
      && event.payload?.phaseId === "night"
    )).toBe(true);
  });

  it("applies day and night economy modifiers to clean and dirty income", () => {
    const state = createCoreStateFixture();
    const context = createContext("free");

    state.root.tick = 0;
    expect(applyDayNightBuildingIncomeModifiers({
      state,
      context,
      buildingTypeId: "restaurant",
      cleanPerHour: 100,
      dirtyPerHour: 100,
      heatPerDay: 10,
      influencePerDay: 0
    })).toMatchObject({
      cleanPerHour: 115,
      dirtyPerHour: 90,
      heatPerDay: 11
    });

    state.root.tick = 240;
    expect(applyDayNightBuildingIncomeModifiers({
      state,
      context,
      buildingTypeId: "strip_club",
      cleanPerHour: 100,
      dirtyPerHour: 100,
      heatPerDay: 10,
      influencePerDay: 0
    })).toMatchObject({
      cleanPerHour: 125,
      dirtyPerHour: 125,
      heatPerDay: 9
    });
  });

  it("applies police pressure and heist chance modifiers", () => {
    const state = createCoreStateFixture();
    const context = createContext("free");
    state.policeStatesById["police:1"] = {
      id: "police:1",
      ownerPlayerId: "player:1",
      heat: 100,
      wantedLevel: 5,
      lastDecayTick: 0,
      activeFlags: [],
      version: 1
    };

    state.root.tick = 0;
    expect(calculatePlayerPolicePressure(state, "player:1", context).playerHeatPressure).toBe(115);
    expect(applyDayNightHeistDetectionChance({ gameState: { ...state, config: context.config }, baseChance: 0.3 })).toBeCloseTo(0.45);

    state.root.tick = 240;
    expect(calculatePlayerPolicePressure(state, "player:1", context).playerHeatPressure).toBe(90);
    expect(applyDayNightHeistDetectionChance({ gameState: { ...state, config: context.config }, baseChance: 0.3 })).toBeCloseTo(0.2);
  });

  it("projects day night read model onto player view", () => {
    const state = createCoreStateFixture();
    const context = createContext("free");
    state.root.tick = 240;

    expect(createDayNightReadModel(state, context)).toMatchObject({
      phaseId: "night",
      label: "NOC",
      remainingTicks: 240,
      uiThemeHint: "night"
    });
    expect(createPlayerView(state, "player:1", context).dayNight).toMatchObject({
      phaseId: "night",
      effectSummary: expect.arrayContaining(["Dirty cash +25 %"])
    });
  });
});
