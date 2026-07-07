import { describe, expect, it } from "vitest";
import {
  applyCommand,
  applyDayNightBuildingIncomeModifiers,
  applyDayNightActionHeat,
  applyDayNightHeistDetectionChance,
  calculatePlayerPolicePressure,
  createDayNightReadModel,
  createPlayerView,
  getCurrentDayNightPhase,
  resolveCityHallNightPatrolPressure,
  resolveDayNightActionRule,
  runTick,
  validateRunBuildingAction
} from "@empire/game-core";
import { resolveModeConfig } from "@empire/game-config";
import {
  createCoreStateFixture,
  createCoreStateWithFixedBuildingFixture,
  createFixedBuildingFixture
} from "../../fixtures/game-state-fixtures";
import { createRunBuildingActionCommandFixture } from "../../fixtures/command-fixtures";

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
      endsAtTick: 1440,
      remainingTicks: 1440
    });

    state.root.tick = 1440;
    expect(getCurrentDayNightPhase(state, context)).toMatchObject({
      phaseId: "night",
      startedAtTick: 1440,
      endsAtTick: 2880,
      remainingTicks: 1440
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
    state.root.tick = 1439;
    state.serverInstance.currentTick = 1439;

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

    state.root.tick = 1440;
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

  it("classifies exchange as an illegal economy building for day night modifiers", () => {
    const state = createCoreStateFixture();
    const context = createContext("free");

    state.root.tick = 1440;
    expect(applyDayNightBuildingIncomeModifiers({
      state,
      context,
      buildingTypeId: "exchange",
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

  it("blocks night only building actions during day and allows them at night", () => {
    const state = createCoreStateFixture();
    const context = createContext("free");

    state.root.tick = 0;
    expect(resolveDayNightActionRule(state, context, "night_machines", "arcade")).toMatchObject({
      allowed: false,
      phaseAvailability: "blocked",
      blockedReason: "Noční automaty se rozjíždí až po setmění."
    });
    expect(resolveDayNightActionRule(state, context, "vip_night", "casino")).toMatchObject({
      allowed: false,
      phaseAvailability: "blocked",
      blockedReason: "VIP noc můžeš spustit jen v noci."
    });

    state.root.tick = 1440;
    expect(resolveDayNightActionRule(state, context, "night_machines", "arcade")).toMatchObject({
      allowed: true,
      phaseAvailability: "buffed",
      phaseBadgeLabel: "NOC BONUS"
    });
    expect(resolveDayNightActionRule(state, context, "vip_night", "casino")).toMatchObject({
      allowed: true,
      phaseAvailability: "buffed",
      phaseBadgeLabel: "NOC BONUS"
    });
  });

  it("returns a stable validation error for phase blocked building actions", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("arcade", {
      playerBalances: { cash: 10000, "dirty-cash": 10000, influence: 100 }
    });
    const context = createContext("free");
    const command = createRunBuildingActionCommandFixture({
      payload: {
        districtId: "district:1",
        buildingId: building.id,
        actionId: "night_machines"
      }
    });

    state.root.tick = 0;
    expect(validateRunBuildingAction(state, command, context)).toContainEqual(expect.objectContaining({
      code: "building_action_phase_blocked",
      message: "Noční automaty se rozjíždí až po setmění."
    }));

    state.root.tick = 1440;
    expect(validateRunBuildingAction(state, command, context).some((error) => error.code === "building_action_phase_blocked")).toBe(false);
  });

  it("allows parliament policy window during day and blocks it at night", () => {
    const state = createCoreStateFixture();
    const context = createContext("free");

    state.root.tick = 0;
    expect(resolveDayNightActionRule(state, context, "parliament_policy_window", "parliament")).toMatchObject({
      allowed: true,
      phaseAvailability: "buffed",
      phaseBadgeLabel: "DEN BONUS"
    });

    state.root.tick = 1440;
    expect(resolveDayNightActionRule(state, context, "parliament_policy_window", "parliament")).toMatchObject({
      allowed: false,
      phaseAvailability: "blocked",
      blockedReason: "Policy Window se otevírá jen přes den."
    });
  });

  it("reports preferred night action badge and applies off-phase risk modifiers", () => {
    const state = createCoreStateFixture();
    const context = createContext("free");

    state.root.tick = 0;
    expect(resolveDayNightActionRule(state, context, "quiet_backroom", "casino")).toMatchObject({
      allowed: true,
      phaseAvailability: "penalized",
      phaseBadgeLabel: "VYŠŠÍ RISK",
      phaseTooltip: expect.stringContaining("NOC BONUS")
    });
    expect(applyDayNightActionHeat(10, state, context, "quiet_backroom", "casino")).toBe(13);

    state.root.tick = 1440;
    expect(resolveDayNightActionRule(state, context, "quiet_backroom", "casino")).toMatchObject({
      allowed: true,
      phaseAvailability: "buffed",
      phaseBadgeLabel: "NOC BONUS"
    });
    expect(applyDayNightActionHeat(10, state, context, "quiet_backroom", "casino")).toBe(10);
  });

  it("applies off-phase cost modifiers to special building action balances", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("city_hall", {
      playerBalances: { cash: 10000 }
    });
    const context = createContext("free");
    state.root.tick = 1440;
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      influence: 1000
    };

    const result = applyCommand(state, createRunBuildingActionCommandFixture({
      payload: {
        districtId: "district:1",
        buildingId: building.id,
        actionId: "official_cover"
      }
    }), context);

    expect(result.errors).toEqual([]);
    expect(result.nextState.resourceStatesById["resource:1"].balances.cash).toBe(8275);
  });

  it("keeps old behavior when action and building rules are absent", () => {
    const state = createCoreStateFixture();
    const config = resolveModeConfig("free");
    const contextWithoutRules = {
      config: {
        ...config,
        balance: {
          ...config.balance,
          dayNight: config.balance.dayNight
            ? {
                ...config.balance.dayNight,
                buildingRules: undefined,
                actionRules: undefined
              }
            : undefined
        }
      }
    };

    state.root.tick = 0;
    expect(resolveDayNightActionRule(state, contextWithoutRules, "night_machines", "arcade")).toMatchObject({
      allowed: true,
      phaseAvailability: "neutral",
      blockedReason: null
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

    state.root.tick = 1440;
    expect(calculatePlayerPolicePressure(state, "player:1", context).playerHeatPressure).toBe(90);
    expect(applyDayNightHeistDetectionChance({ gameState: { ...state, config: context.config }, baseChance: 0.3 })).toBeCloseTo(0.2);
  });

  it("projects day night read model onto player view", () => {
    const state = createCoreStateFixture();
    const context = createContext("free");
    state.root.tick = 1440;

    expect(createDayNightReadModel(state, context)).toMatchObject({
      phaseId: "night",
      label: "NOC",
      remainingTicks: 1440,
      uiThemeHint: "night"
    });
    expect(createPlayerView(state, "player:1", context).dayNight).toMatchObject({
      phaseId: "night",
      effectSummary: expect.arrayContaining(["Dirty cash +25 %"])
    });
  });

  it("keeps day night read model effect summary and theme hint stable", () => {
    const state = createCoreStateFixture();
    const context = createContext("free");
    state.root.tick = 0;

    expect(createDayNightReadModel(state, context)).toMatchObject({
      phaseId: "day",
      uiThemeHint: "day",
      effectSummary: expect.arrayContaining(["Legální byznys +15 %"])
    });
  });

  it("applies City Hall night patrol pressure only at night against protected districts", () => {
    const state = createCoreStateFixture();
    const context = createContext("free");
    const cityHall = createFixedBuildingFixture("city_hall", {
      id: "building:city-hall:1",
      districtId: "district:1",
      ownerPlayerId: "player:1",
      metadata: {
        cityHall: {
          officialCoverByDistrictId: {},
          emergencyDecree: {
            modeId: "night_patrols",
            expiresAtTick: 2000
          },
          riskEvents: [],
          scandalEvents: []
        }
      }
    });
    state.buildingsById[cityHall.id] = cityHall;

    state.root.tick = 0;
    expect(resolveCityHallNightPatrolPressure({
      state,
      context,
      targetDistrict: state.districtsById["district:1"]
    })).toMatchObject({
      active: false,
      durationMultiplier: 1,
      cooldownMultiplier: 1,
      heatMultiplier: 1
    });

    state.root.tick = 1440;
    expect(resolveCityHallNightPatrolPressure({
      state,
      context,
      targetDistrict: state.districtsById["district:1"]
    })).toMatchObject({
      active: true,
      durationMultiplier: 1.08,
      cooldownMultiplier: 1.12,
      heatMultiplier: 1.08,
      effectSummary: expect.stringContaining("Noční hlídky")
    });
  });
});
