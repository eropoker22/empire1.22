import { describe, expect, it } from "vitest";
import {
  applyCommand,
  applyDayNightBuildingIncomeModifiers,
  applyDayNightActionHeat,
  applyDayNightProductionMultiplier,
  applyDayNightHeistDetectionChance,
  calculatePlayerPolicePressure,
  collectIncome,
  createDayNightReadModel,
  createDistrictPanelView,
  createPlayerView,
  getCurrentDayNightPhase,
  resolveCityHallNightPatrolPressure,
  resolveDayNightActionRule,
  resolveDayNightBuildingEconomyType,
  resolveDayNightPassiveBuildingRule,
  resolveEffectiveBuildingActionPreview,
  runTick,
  validateRunBuildingAction
} from "@empire/game-core";
import { getAllPublicBuildingDefinitions, resolveDayNightPhaseDurationTicks, resolveModeConfig } from "@empire/game-config";
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

  it("derives a two hour phase duration from mode tick rate", () => {
    const freeConfig = resolveModeConfig("free");
    const warConfig = resolveModeConfig("war");

    expect(resolveDayNightPhaseDurationTicks(5000)).toBe(1440);
    expect(freeConfig.balance.dayLengthTicks).toBe(freeConfig.balance.nightLengthTicks);
    expect(warConfig.balance.dayLengthTicks).toBe(warConfig.balance.nightLengthTicks);
  });

  it("calculates war mode duration from config", () => {
    const state = createCoreStateFixture();
    const context = createContext("war");
    state.root.tick = 479;

    expect(getCurrentDayNightPhase(state, context)).toMatchObject({
      phaseId: "day",
      endsAtTick: 480,
      remainingTicks: 1
    });

    state.root.tick = 480;
    expect(getCurrentDayNightPhase(state, context)).toMatchObject({
      phaseId: "night",
      startedAtTick: 480,
      endsAtTick: 960
    });
  });

  it("projects deterministic game clock labels across day and night", () => {
    const state = createCoreStateFixture();
    const context = createContext("free");

    state.root.tick = 0;
    expect(createDayNightReadModel(state, context)).toMatchObject({
      phaseId: "day",
      gameClockLabel: "06:00",
      gameHour: 6,
      gameMinute: 0,
      phaseStartsAtGameHour: 6,
      phaseEndsAtGameHour: 18,
      realPhaseDurationMs: 2 * 60 * 60 * 1000
    });

    state.root.tick = 720;
    expect(createDayNightReadModel(state, context)).toMatchObject({
      phaseId: "day",
      gameClockLabel: "12:00"
    });

    state.root.tick = 1439;
    expect(createDayNightReadModel(state, context)).toMatchObject({
      phaseId: "day",
      gameClockLabel: "17:59"
    });

    state.root.tick = 1440;
    expect(createDayNightReadModel(state, context)).toMatchObject({
      phaseId: "night",
      gameClockLabel: "18:00",
      phaseStartsAtGameHour: 18,
      phaseEndsAtGameHour: 6
    });

    state.root.tick = 2160;
    expect(createDayNightReadModel(state, context)).toMatchObject({
      phaseId: "night",
      gameClockLabel: "00:00"
    });

    state.root.tick = 2879;
    expect(createDayNightReadModel(state, context)).toMatchObject({
      phaseId: "night",
      gameClockLabel: "05:59"
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
      cleanPerHour: 132,
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
      dirtyPerHour: 156,
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
      cleanPerHour: 135,
      dirtyPerHour: 150,
      heatPerDay: 9
    });
    expect(resolveDayNightBuildingEconomyType("exchange")).toBe("illegal");
  });

  it("applies specific passive day night modifiers to fixed building income", () => {
    const state = createCoreStateFixture();
    const context = createContext("free");

    state.root.tick = 0;
    const restaurantDay = applyDayNightBuildingIncomeModifiers({
      state,
      context,
      buildingTypeId: "restaurant",
      cleanPerHour: 100,
      dirtyPerHour: 0,
      heatPerDay: 10,
      influencePerDay: 10
    });
    const cityHallDayRule = resolveDayNightPassiveBuildingRule(state, context, "city_hall");

    state.root.tick = 1440;
    const restaurantNight = applyDayNightBuildingIncomeModifiers({
      state,
      context,
      buildingTypeId: "restaurant",
      cleanPerHour: 100,
      dirtyPerHour: 0,
      heatPerDay: 10,
      influencePerDay: 10
    });

    expect(restaurantDay.cleanPerHour).toBeGreaterThan(restaurantNight.cleanPerHour);
    expect(cityHallDayRule.modifiers.passiveInfluenceMultiplier).toBe(1.2);
    expect(cityHallDayRule.modifiers.passiveHeatMultiplier).toBeLessThan(1);
  });

  it("makes casino stronger at night for passive dirty income", () => {
    const state = createCoreStateFixture();
    const context = createContext("free");

    state.root.tick = 0;
    const day = applyDayNightBuildingIncomeModifiers({
      state,
      context,
      buildingTypeId: "casino",
      cleanPerHour: 0,
      dirtyPerHour: 100,
      heatPerDay: 10,
      influencePerDay: 10
    });

    state.root.tick = 1440;
    const night = applyDayNightBuildingIncomeModifiers({
      state,
      context,
      buildingTypeId: "casino",
      cleanPerHour: 0,
      dirtyPerHour: 100,
      heatPerDay: 10,
      influencePerDay: 10
    });

    expect(night.dirtyPerHour).toBeGreaterThan(day.dirtyPerHour);
    expect(night.influencePerDay).toBeGreaterThan(day.influencePerDay);
  });

  it("applies passive population and production modifiers to school and lab loops", () => {
    const context = createContext("free");
    const daySchoolFixture = createCoreStateWithFixedBuildingFixture("school");
    daySchoolFixture.state.root.tick = 12;
    daySchoolFixture.building.metadata = {
      school: {
        storedStudents: 0,
        lastUpdatedTick: 0
      }
    };
    const nightSchoolFixture = createCoreStateWithFixedBuildingFixture("school");
    nightSchoolFixture.state.root.tick = 1452;
    nightSchoolFixture.building.metadata = {
      school: {
        storedStudents: 0,
        lastUpdatedTick: 1440
      }
    };

    const daySchool = collectIncome(daySchoolFixture.state, context);
    const nightSchool = collectIncome(nightSchoolFixture.state, context);
    const dayStudents = Number((daySchool.buildingsById[daySchoolFixture.building.id]?.metadata as any)?.school?.storedStudents || 0);
    const nightStudents = Number((nightSchool.buildingsById[nightSchoolFixture.building.id]?.metadata as any)?.school?.storedStudents || 0);

    expect(dayStudents).toBeGreaterThan(nightStudents);

    const state = createCoreStateFixture();
    state.root.tick = 0;
    const drugLabDay = applyDayNightProductionMultiplier({
      state,
      context,
      buildingTypeId: "drug_lab",
      amountPerTick: 100
    });
    state.root.tick = 1440;
    const drugLabNight = applyDayNightProductionMultiplier({
      state,
      context,
      buildingTypeId: "drug_lab",
      amountPerTick: 100
    });

    expect(drugLabNight).toBeGreaterThan(drugLabDay);
  });

  it("keeps main passive day night building modifiers within first-test sanity bounds", () => {
    const state = createCoreStateFixture();
    const context = createContext("free");
    const buildingTypeIds = [
      "restaurant",
      "shopping_mall",
      "city_hall",
      "court",
      "central_bank",
      "stock_exchange",
      "school",
      "clinic",
      "casino",
      "arcade",
      "exchange",
      "strip_club",
      "vip_lounge",
      "smuggling_tunnel",
      "street_dealers",
      "drug_lab",
      "port",
      "convenience_store"
    ];

    const rows = buildingTypeIds.map((buildingTypeId) => {
      state.root.tick = 0;
      const dayIncome = applyDayNightBuildingIncomeModifiers({
        state,
        context,
        buildingTypeId,
        cleanPerHour: 100,
        dirtyPerHour: 100,
        heatPerDay: 10,
        influencePerDay: 10
      });
      const dayProduction = applyDayNightProductionMultiplier({
        state,
        context,
        buildingTypeId,
        amountPerTick: 100
      });
      const dayRule = resolveDayNightPassiveBuildingRule(state, context, buildingTypeId);

      state.root.tick = 1440;
      const nightIncome = applyDayNightBuildingIncomeModifiers({
        state,
        context,
        buildingTypeId,
        cleanPerHour: 100,
        dirtyPerHour: 100,
        heatPerDay: 10,
        influencePerDay: 10
      });
      const nightProduction = applyDayNightProductionMultiplier({
        state,
        context,
        buildingTypeId,
        amountPerTick: 100
      });
      const nightRule = resolveDayNightPassiveBuildingRule(state, context, buildingTypeId);

      return {
        buildingTypeId,
        dayClean: dayIncome.cleanPerHour,
        nightClean: nightIncome.cleanPerHour,
        dayDirty: dayIncome.dirtyPerHour,
        nightDirty: nightIncome.dirtyPerHour,
        dayHeat: dayIncome.heatPerDay,
        nightHeat: nightIncome.heatPerDay,
        dayInfluence: dayIncome.influencePerDay,
        nightInfluence: nightIncome.influencePerDay,
        dayProduction,
        nightProduction,
        dayBadge: dayRule.phaseBadgeLabel,
        nightBadge: nightRule.phaseBadgeLabel
      };
    });

    if (process.env.DAY_NIGHT_BALANCE_REPORT === "1") {
      console.table(rows);
    }

    const restaurant = rows.find((row) => row.buildingTypeId === "restaurant");
    const casino = rows.find((row) => row.buildingTypeId === "casino");
    const exchange = rows.find((row) => row.buildingTypeId === "exchange");
    const drugLab = rows.find((row) => row.buildingTypeId === "drug_lab");
    const cityHall = rows.find((row) => row.buildingTypeId === "city_hall");

    expect(restaurant?.dayClean).toBeGreaterThan(restaurant?.nightClean ?? 0);
    expect(casino?.nightDirty).toBeGreaterThan(casino?.dayDirty ?? 0);
    expect(exchange?.nightDirty).toBeGreaterThan(exchange?.dayDirty ?? 0);
    expect(drugLab?.nightProduction).toBeGreaterThan(drugLab?.dayProduction ?? 0);
    expect(cityHall?.dayInfluence).toBeGreaterThan(cityHall?.nightInfluence ?? 0);

    for (const row of rows) {
      expect(Math.max(row.dayDirty, row.nightDirty), `${row.buildingTypeId} dirty income sanity`).toBeLessThanOrEqual(160);
      expect(Math.max(row.dayClean, row.nightClean), `${row.buildingTypeId} clean income sanity`).toBeLessThanOrEqual(140);
      expect(Math.max(row.dayHeat, row.nightHeat), `${row.buildingTypeId} heat sanity`).toBeLessThanOrEqual(14);
      expect(Math.max(row.dayInfluence, row.nightInfluence), `${row.buildingTypeId} influence sanity`).toBeLessThanOrEqual(13);
      expect(Math.max(row.dayProduction, row.nightProduction), `${row.buildingTypeId} production sanity`).toBeLessThanOrEqual(155);
    }

    const garageDayRule = resolveDayNightPassiveBuildingRule(state, context, "garage");
    expect(garageDayRule.phaseBadgeLabel).toBeNull();
    expect(garageDayRule.phaseEffectLabel).toBeNull();
  });

  it("keeps passive building behavior compatible when building rules are absent", () => {
    const state = createCoreStateFixture();
    const config = resolveModeConfig("free");
    const contextWithoutBuildingRules = {
      config: {
        ...config,
        balance: {
          ...config.balance,
          dayNight: config.balance.dayNight
            ? {
                ...config.balance.dayNight,
                buildingRules: undefined
              }
            : undefined
        }
      }
    };

    state.root.tick = 0;
    expect(applyDayNightBuildingIncomeModifiers({
      state,
      context: contextWithoutBuildingRules,
      buildingTypeId: "restaurant",
      cleanPerHour: 100,
      dirtyPerHour: 0,
      heatPerDay: 10,
      influencePerDay: 0
    })).toMatchObject({
      cleanPerHour: 115,
      dirtyPerHour: 0,
      heatPerDay: 11
    });
  });

  it("projects passive day night effect into district building read model", () => {
    const { state } = createCoreStateWithFixedBuildingFixture("restaurant", {
      playerBalances: { cash: 10000 }
    });
    const context = createContext("free");
    state.root.tick = 0;

    const panel = createDistrictPanelView(state, {
      districtId: "district:1",
      playerId: "player:1",
      issuedAt: new Date(0).toISOString(),
      buildCatalog: getAllPublicBuildingDefinitions(),
      productionCatalog: {},
      craftCatalog: {},
      buildingActionCatalog: context.config.balance.buildingActions ?? {},
      config: context.config,
      productionMultiplier: 1,
      tickRateMs: context.config.tickRateMs,
      conflictConfig: context.config.balance.conflict
    });
    const building = panel?.buildings.find((entry) => entry.buildingTypeId === "restaurant");

    expect(building).toMatchObject({
      passivePhaseBadgeLabel: "DEN BONUS",
      passivePhaseEffectLabel: expect.stringMatching(/Clean \$\d+\/h -> \$\d+\/h/u)
    });
    expect(building?.stats.find((stat) => stat.label === "Clean / h")?.value).toContain("->");
    expect(building?.stats.find((stat) => stat.label === "Efekt fáze")?.value).toMatch(/\/h ->/u);
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
      phaseTooltip: expect.stringContaining("vyšší heat")
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

  it("keeps preferred phase copy neutral when no mechanical modifier is active", () => {
    const state = createCoreStateFixture();
    const config = resolveModeConfig("free");
    const preferredOnlyContext = {
      config: {
        ...config,
        balance: {
          ...config.balance,
          dayNight: config.balance.dayNight
            ? {
                ...config.balance.dayNight,
                actionRules: {
                  ...(config.balance.dayNight.actionRules ?? {}),
                  preferred_only_demo: {
                    preferredPhase: "night" as const,
                    phaseEffectSummary: "Noc je pro tuhle akci tematicky lepší."
                  }
                }
              }
            : undefined
        }
      }
    };

    state.root.tick = 0;
    expect(resolveDayNightActionRule(state, preferredOnlyContext, "preferred_only_demo", "casino")).toMatchObject({
      allowed: true,
      phaseAvailability: "neutral",
      phaseBadgeLabel: "LEPŠÍ V NOCI",
      mechanicalEffectLabels: []
    });
  });

  it("reports higher risk only when an off-phase rule has a consumed modifier", () => {
    const state = createCoreStateFixture();
    const context = createContext("free");

    state.root.tick = 0;
    expect(resolveDayNightActionRule(state, context, "bar_whispers", "strip_club")).toMatchObject({
      allowed: true,
      phaseAvailability: "neutral",
      phaseBadgeLabel: "LEPŠÍ V NOCI",
      mechanicalEffectLabels: []
    });
    expect(resolveDayNightActionRule(state, context, "quiet_backroom", "casino")).toMatchObject({
      allowed: true,
      phaseAvailability: "penalized",
      phaseBadgeLabel: "VYŠŠÍ RISK",
      mechanicalEffectLabels: expect.arrayContaining(["vyšší heat", "nižší reward"])
    });
  });

  it("projects effective day night action preview from the same helpers as core execution", () => {
    const state = createCoreStateFixture();
    const context = createContext("free");
    const officialCover = context.config.balance.buildingActions?.official_cover;
    expect(officialCover).toBeDefined();

    state.root.tick = 1440;
    const preview = resolveEffectiveBuildingActionPreview({
      action: officialCover!,
      state,
      context,
      buildingTypeId: "city_hall"
    });

    expect(preview).toMatchObject({
      baseInputCost: { cash: 1500 },
      effectiveInputCost: { cash: 1725 },
      baseHeatGain: 2,
      effectiveHeatGain: 3,
      phaseAvailability: "penalized",
      phaseBadgeLabel: "VYŠŠÍ RISK",
      preferredPhase: "day",
      currentPhase: "night"
    });
    expect(preview.phaseEffectSummary).toEqual(expect.arrayContaining([
      "Cena cash 1500 -> 1725",
      "Heat +2 -> +3"
    ]));
  });

  it("applies reward preview modifiers only in the off preferred phase", () => {
    const state = createCoreStateFixture();
    const context = createContext("free");
    const syntheticQuietBackroom = {
      actionId: "quiet_backroom",
      inputCost: {},
      outputGain: { cash: 100 },
      heatGain: 7,
      cooldownMs: 14 * 60_000,
      durationMs: 0
    };

    state.root.tick = 0;
    expect(resolveEffectiveBuildingActionPreview({
      action: syntheticQuietBackroom,
      state,
      context,
      buildingTypeId: "casino"
    })).toMatchObject({
      effectiveOutputGain: { cash: 90 },
      effectiveHeatGain: 9,
      phaseAvailability: "penalized"
    });

    state.root.tick = 1440;
    expect(resolveEffectiveBuildingActionPreview({
      action: syntheticQuietBackroom,
      state,
      context,
      buildingTypeId: "casino"
    })).toMatchObject({
      effectiveOutputGain: { cash: 100 },
      effectiveHeatGain: 7,
      phaseAvailability: "buffed"
    });
  });

  it("projects hard blocked action preview by current phase", () => {
    const state = createCoreStateFixture();
    const context = createContext("free");
    const nightMachines = context.config.balance.buildingActions?.night_machines;
    expect(nightMachines).toBeDefined();

    state.root.tick = 0;
    expect(resolveEffectiveBuildingActionPreview({
      action: nightMachines!,
      state,
      context,
      buildingTypeId: "arcade"
    })).toMatchObject({
      phaseAvailability: "blocked",
      phaseBadgeLabel: "FÁZE BLOK",
      blockedReason: "Noční automaty se rozjíždí až po setmění.",
      currentPhase: "day"
    });

    state.root.tick = 1440;
    expect(resolveEffectiveBuildingActionPreview({
      action: nightMachines!,
      state,
      context,
      buildingTypeId: "arcade"
    })).toMatchObject({
      phaseAvailability: "buffed",
      phaseBadgeLabel: "NOC BONUS",
      blockedReason: null,
      currentPhase: "night"
    });
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

  it("validates building action affordability against day night adjusted cost", () => {
    const { state, building } = createCoreStateWithFixedBuildingFixture("city_hall", {
      playerBalances: { cash: 1500 }
    });
    const context = createContext("free");
    const command = createRunBuildingActionCommandFixture({
      payload: {
        districtId: "district:1",
        buildingId: building.id,
        actionId: "official_cover"
      }
    });
    state.root.tick = 1440;
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      influence: 1000
    };

    expect(validateRunBuildingAction(state, command, context)).toContainEqual(expect.objectContaining({
      code: "building_action_insufficient_resources",
      message: "Missing resources: 1725 cash."
    }));
  });

  it("uses the same effective preview numbers in the district action read model", () => {
    const { state } = createCoreStateWithFixedBuildingFixture("city_hall", {
      playerBalances: { cash: 10000, influence: 1000 }
    });
    const context = createContext("free");
    state.root.tick = 1440;
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      influence: 1000
    };
    const action = context.config.balance.buildingActions?.official_cover;
    const helperPreview = resolveEffectiveBuildingActionPreview({
      action: action!,
      state,
      context,
      buildingTypeId: "city_hall"
    });

    const panel = createDistrictPanelView(state, {
      districtId: "district:1",
      playerId: "player:1",
      issuedAt: new Date(0).toISOString(),
      buildCatalog: getAllPublicBuildingDefinitions(),
      productionCatalog: {},
      craftCatalog: {},
      buildingActionCatalog: context.config.balance.buildingActions ?? {},
      config: context.config,
      productionMultiplier: 1,
      tickRateMs: context.config.tickRateMs,
      conflictConfig: context.config.balance.conflict,
      cityHallConfig: context.config.balance.cityHall
    });
    const projectedAction = panel?.buildings
      .find((building) => building.buildingTypeId === "city_hall")
      ?.actions.find((buildingAction) => buildingAction.actionId === "official_cover");

    expect(projectedAction).toMatchObject({
      inputCost: helperPreview.effectiveInputCost,
      outputGain: helperPreview.effectiveOutputGain,
      heatGain: helperPreview.effectiveHeatGain,
      cooldownMs: helperPreview.effectiveCooldownMs,
      durationMs: helperPreview.effectiveDurationMs,
      baseInputCost: helperPreview.baseInputCost,
      effectiveInputCost: helperPreview.effectiveInputCost,
      baseHeatGain: helperPreview.baseHeatGain,
      effectiveHeatGain: helperPreview.effectiveHeatGain,
      phaseBadgeLabel: helperPreview.phaseBadgeLabel,
      currentPhase: helperPreview.currentPhase
    });
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
      effectSummary: expect.arrayContaining(["Legální byznys +15 %"]),
      recommendations: expect.arrayContaining(["Magistrát / Soud / Banka / Burza"])
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
