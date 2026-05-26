import { describe, expect, it } from "vitest";
import {
  applyFactionAggressiveHeatGain,
  applyFactionChanceBonus,
  applyFactionCooldownTicks,
  applyFactionDefenseSystemEffectiveness,
  applyFactionEquipmentLosses,
  applyFactionIllegalActionHeatGain,
  applyFactionPopulationGeneration,
  applyFactionRobberyDirtyCashLoot,
  applyFactionRobberyLoot,
  applyFactionRumorTruthChancePct,
  applyFactionSmugglingIncome,
  applyFactionStartingPackage,
  applyFactionTrapDetectionChance,
  calculateIncomeByPlayerId,
  completeProduction,
  createFactionReadModel,
  createPlayerView,
  getFactionPassiveModifiers,
  normalizeFactionId,
  resolveFactionAlarmEffectivenessMultiplier,
  resolveFactionBaseDefensePowerMultiplier,
  resolveFactionCameraEffectivenessMultiplier,
  resolveFactionProductionMultiplier,
  resolveRumorEvent,
  validatePlaceTrap
} from "@empire/game-core";
import {
  FACTION_DEFINITION_BY_ID,
  FACTION_DEFINITIONS,
  LEGACY_FACTION_ID_MAP,
  resolveModeConfig
} from "@empire/game-config";
import { FACTION_PASSIVE_MODIFIER_KEYS, PLAYER_FACTION_IDS } from "@empire/shared-types";
import {
  FACTION_PASSIVE_MODIFIER_USAGE,
  listFactionPassiveModifierUsage,
  listUnusedPlannedFactionPassiveModifiers
} from "../../../tools/debug/src/free-mode-pacing/factionPassiveAudit";
import { resolveFactionBotBehavior } from "../../../tools/debug/src/free-mode-pacing/factionBotBehavior";
import {
  createCoreStateFixture,
  createFixedBuildingFixture,
  createResourceStateFixture
} from "../../fixtures/game-state-fixtures";

const context = { config: resolveModeConfig("free") };

describe("faction core foundation", () => {
  it("has a canonical definition for every PlayerFactionId", () => {
    expect(FACTION_DEFINITIONS.map((definition) => definition.id).sort()).toEqual([...PLAYER_FACTION_IDS].sort());
    for (const factionId of PLAYER_FACTION_IDS) {
      expect(FACTION_DEFINITION_BY_ID[factionId]).toMatchObject({
        id: factionId,
        name: expect.any(String),
        passiveModifiers: expect.any(Object)
      });
    }
  });

  it("maps legacy faction ids to canonical ids and safely falls back", () => {
    expect(LEGACY_FACTION_ID_MAP.mafia).toBe("mafian");
    expect(LEGACY_FACTION_ID_MAP.cartel).toBe("kartel");
    expect(LEGACY_FACTION_ID_MAP.cult).toBe("kult");
    expect(LEGACY_FACTION_ID_MAP.corporation).toBe("korporace");
    expect(LEGACY_FACTION_ID_MAP.military).toBe("soukroma-armada");
    expect(normalizeFactionId("mafia", context.config)).toBe("mafian");
    expect(normalizeFactionId("cult", context.config)).toBe("kult");
    expect(normalizeFactionId("corporation", context.config)).toBe("korporace");
    expect(normalizeFactionId("military", context.config)).toBe("soukroma-armada");
    expect(normalizeFactionId("hackers", context.config)).toBe("hackeri");
    expect(normalizeFactionId("unknown", context.config)).toBe("mafian");
  });

  it("does not define faction starting packages", () => {
    for (const definition of FACTION_DEFINITIONS) {
      expect(definition.startingPackage).toBeUndefined();
    }
    expect(FACTION_DEFINITION_BY_ID.mafian.startingPackage).toBeUndefined();
  });

  it("applies the small passive balance patch values", () => {
    expect(FACTION_DEFINITION_BY_ID["soukroma-armada"].passiveModifiers).toMatchObject({
      attackPowerMultiplier: 1.12,
      defensePowerMultiplier: 1.12,
      equipmentLossMultiplier: 0.9,
      occupyPowerMultiplier: 1.1,
      upkeepCostMultiplier: 1.12,
      aggressiveActionHeatGainMultiplier: 1.08,
      cleanIncomeMultiplier: 0.92
    });
    expect(FACTION_DEFINITION_BY_ID["soukroma-armada"].startingPackage).toBeUndefined();
    expect(FACTION_DEFINITION_BY_ID.korporace.passiveModifiers).toMatchObject({
      cleanIncomeMultiplier: 1.15,
      heatGainMultiplier: 0.97,
      defenseSystemEffectivenessMultiplier: 1.1,
      marketFeeMultiplier: 0.9,
      dirtyIncomeMultiplier: 0.85,
      robberyLootMultiplier: 0.9,
      attackDurationMultiplier: 1.1
    });
    expect(FACTION_DEFINITION_BY_ID.korporace.startingPackage).toBeUndefined();
    expect(FACTION_DEFINITION_BY_ID.kartel.passiveModifiers).toMatchObject({
      dirtyIncomeMultiplier: 1.18,
      illegalProductionMultiplier: 1.15,
      smugglingIncomeMultiplier: 1.1,
      illegalActionHeatGainMultiplier: 1.15,
      cleanIncomeMultiplier: 0.92,
      defensePowerMultiplier: 0.95
    });
    expect(FACTION_DEFINITION_BY_ID.kartel.startingPackage).toBeUndefined();
    expect(FACTION_DEFINITION_BY_ID["tajna-organizace"].passiveModifiers).toMatchObject({
      spySuccessChanceBonus: 0.15,
      spyInfoQualityMultiplier: 1.15,
      trapDetectionChanceBonus: 0.15,
      secretActionHeatGainMultiplier: 0.92,
      rumorTruthMultiplier: 1.1,
      attackPowerMultiplier: 0.9,
      cleanIncomeMultiplier: 0.92,
      dirtyIncomeMultiplier: 0.92
    });
    expect(FACTION_DEFINITION_BY_ID["tajna-organizace"].startingPackage).toBeUndefined();
    expect(FACTION_DEFINITION_BY_ID["motorkarsky-gang"].passiveModifiers).toMatchObject({
      robberyCooldownMultiplier: 0.85,
      attackCooldownMultiplier: 0.9,
      occupyCooldownMultiplier: 0.9,
      robberyDirtyCashLootMultiplier: 1.1,
      defensePowerMultiplier: 0.9,
      aggressiveActionHeatGainMultiplier: 1.08
    });
    expect(FACTION_DEFINITION_BY_ID["motorkarsky-gang"].startingPackage).toBeUndefined();
    expect(FACTION_DEFINITION_BY_ID.kult.passiveModifiers).toMatchObject({
      influenceGainMultiplier: 1.2,
      populationGenerationMultiplier: 1.1,
      defensePowerMultiplier: 1.1,
      rumorGenerationMultiplier: 1.1,
      cleanIncomeMultiplier: 0.9,
      marketFeeMultiplier: 1.1,
      attackPowerMultiplier: 0.95
    });
    expect(FACTION_DEFINITION_BY_ID.kult.startingPackage).toBeUndefined();
    expect(FACTION_DEFINITION_BY_ID.hackeri.passiveModifiers).toMatchObject({
      rumorTruthMultiplier: 1.5,
      cameraEffectivenessMultiplier: 1.15,
      alarmEffectivenessMultiplier: 1.15,
      techProductionMultiplier: 1.1,
      spySuccessChanceBonus: 0.1,
      attackPowerMultiplier: 0.92,
      dirtyIncomeMultiplier: 0.92,
      baseDefensePowerMultiplier: 0.95
    });
    expect(FACTION_DEFINITION_BY_ID.hackeri.startingPackage).toBeUndefined();
  });

  it("keeps every passive modifier valid and explicitly audited", () => {
    const definedModifierKeys = new Set<string>();

    for (const definition of FACTION_DEFINITIONS) {
      for (const [key, value] of Object.entries(definition.passiveModifiers)) {
        definedModifierKeys.add(key);
        expect(FACTION_PASSIVE_MODIFIER_KEYS).toContain(key);
        expect(value).toEqual(expect.any(Number));
        if (key.endsWith("Bonus")) {
          expect(value).toBeGreaterThanOrEqual(-0.25);
          expect(value).toBeLessThanOrEqual(0.25);
        } else if (key === "rumorTruthMultiplier") {
          expect(value).toBeGreaterThanOrEqual(0.75);
          expect(value).toBeLessThanOrEqual(1.5);
        } else {
          expect(value).toBeGreaterThanOrEqual(0.75);
          expect(value).toBeLessThanOrEqual(1.25);
        }
      }
    }

    for (const usage of listFactionPassiveModifierUsage()) {
      expect(["active", "partial", "planned"]).toContain(usage.status);
      expect(usage.note.length).toBeGreaterThan(10);
      if (usage.status === "active") {
        expect(usage.surfaces.length).toBeGreaterThan(0);
      }
    }

    for (const modifierKey of definedModifierKeys) {
      expect(FACTION_PASSIVE_MODIFIER_USAGE[modifierKey as keyof typeof FACTION_PASSIVE_MODIFIER_USAGE]).toBeDefined();
    }
    expect([...definedModifierKeys].filter((key) =>
      FACTION_PASSIVE_MODIFIER_USAGE[key as keyof typeof FACTION_PASSIVE_MODIFIER_USAGE]?.status === "planned"
    ).sort()).toEqual([
      "marketFeeMultiplier",
      "occupyPowerMultiplier",
      "rumorGenerationMultiplier",
      "secretActionHeatGainMultiplier",
      "spyInfoQualityMultiplier",
      "upkeepCostMultiplier"
    ].sort());
    expect(listUnusedPlannedFactionPassiveModifiers().map((usage) => usage.key).sort()).toEqual([
      "marketFeeMultiplier",
      "occupyPowerMultiplier",
      "rumorGenerationMultiplier",
      "secretActionHeatGainMultiplier",
      "spyInfoQualityMultiplier",
      "upkeepCostMultiplier"
    ].sort());
  });

  it("keeps the old starting package API as a no-op compatibility shim", () => {
    const state = createCoreStateFixture();
    state.playersById["player:1"] = {
      ...state.playersById["player:1"],
      factionId: "kartel"
    };
    state.policeStatesById["police:1"] = {
      id: "police:1",
      ownerPlayerId: "player:1",
      heat: 0,
      wantedLevel: 0,
      lastDecayTick: 0,
      activeFlags: [],
      version: 1
    };

    const nextState = applyFactionStartingPackage(state, "player:1", context);

    expect(nextState.resourceStatesById["resource:1"].balances).toMatchObject({
      cash: 1000
    });
    expect(nextState.resourceStatesById["resource:1"].balances["dirty-cash"] ?? 0).toBe(0);
    expect(nextState.resourceStatesById["resource:1"].balances.chemicals ?? 0).toBe(0);
    expect(nextState.playersById["player:1"].attackLoadout.pistol ?? 0).toBe(0);
    expect(nextState.policeStatesById["police:1"].heat).toBe(0);
  });

  it("applies clean and dirty income passives without mutating gameplay state", () => {
    const state = createCoreStateFixture();
    state.playersById["player:1"] = {
      ...state.playersById["player:1"],
      factionId: "korporace"
    };
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      resourceModifiers: {
        cash: 100,
        "dirty-cash": 100
      }
    };
    const before = state.playersById["player:1"].version;

    const income = calculateIncomeByPlayerId(state, context)["player:1"];

    expect(income.cash).toBeCloseTo(115);
    expect(income["dirty-cash"]).toBe(85);
    expect(state.playersById["player:1"].version).toBe(before);
  });

  it("applies production passive for tech factions", () => {
    const state = createCoreStateFixture();
    const building = createFixedBuildingFixture("factory", {
      id: "building:district-1:factory:1",
      buildingTypeId: "factory"
    });
    state.root.tick = 1;
    state.playersById["player:1"] = {
      ...state.playersById["player:1"],
      factionId: "hackeri"
    };
    state.buildingsById[building.id] = building;
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      buildingIds: [building.id]
    };
    state.resourceStatesById[`resource:${building.id}`] = createResourceStateFixture({
      id: `resource:${building.id}`,
      ownerType: "building",
      ownerId: building.id,
      balances: { "metal-parts": 0 },
      lastUpdatedTick: 0
    });
    const config = {
      ...context.config,
      balance: {
        ...context.config.balance,
        productionMultiplier: 1,
        productionBuildings: {
          factory: { resourceKey: "tech-core", resourceLabel: "Tech Core", amountPerTick: 10, storageCap: 50 }
        }
      }
    };

    const nextState = completeProduction(state, { config });

    expect(nextState.resourceStatesById[`resource:${building.id}`].balances["tech-core"]).toBe(12);
  });

  it("applies Kartel dirty income, illegal production, smuggling and illegal heat modifiers", () => {
    const state = createCoreStateFixture();
    const building = createFixedBuildingFixture("drug_lab", {
      id: "building:district-1:drug-lab:1",
      buildingTypeId: "drug_lab",
      ownerPlayerId: "player:1"
    });
    state.root.tick = 1;
    state.playersById["player:1"] = {
      ...state.playersById["player:1"],
      factionId: "kartel"
    };
    state.districtsById["district:1"] = {
      ...state.districtsById["district:1"],
      resourceModifiers: {
        cash: 100,
        "dirty-cash": 100
      },
      buildingIds: [building.id]
    };
    const modifiers = FACTION_DEFINITION_BY_ID.kartel.passiveModifiers;

    const income = calculateIncomeByPlayerId(state, context)["player:1"];

    expect(income.cash).toBeCloseTo(92);
    expect(income["dirty-cash"]).toBeCloseTo(118);
    expect(resolveFactionProductionMultiplier("chemicals", building.buildingTypeId, modifiers)).toBeCloseTo(1.15);
    expect(applyFactionSmugglingIncome(100, modifiers)).toBeCloseTo(110);
    expect(applyFactionIllegalActionHeatGain(100, modifiers)).toBe(115);
    expect(applyFactionIllegalActionHeatGain(100, {})).toBe(100);
  });

  it("applies secret organization spy and trap detection modifiers through core helpers", () => {
    const state = createCoreStateFixture();
    state.playersById["player:1"] = {
      ...state.playersById["player:1"],
      factionId: "tajna-organizace"
    };
    const modifiers = getFactionPassiveModifiers(state, "player:1", context);

    expect(applyFactionChanceBonus(0.72, modifiers.spySuccessChanceBonus)).toBeCloseTo(0.87);
    expect(applyFactionTrapDetectionChance(0.22, modifiers)).toBeCloseTo(0.37);
    expect(applyFactionTrapDetectionChance(0.9, modifiers)).toBe(0.98);
    expect(modifiers.spySuccessChanceBonus).toBe(0.15);
  });

  it("applies hacker rumor, camera, alarm and base defense modifiers without extra traps", () => {
    const state = createCoreStateFixture();
    state.playersById["player:1"] = {
      ...state.playersById["player:1"],
      factionId: "hackeri"
    };
    state.trapsById["trap:district-1"] = {
      id: "trap:district-1",
      serverInstanceId: "instance:1",
      districtId: "district:1",
      ownerPlayerId: "player:1",
      status: "active",
      placedAtTick: 1,
      triggeredAtTick: null,
      version: 1
    };
    state.districtsById["district:2"] = {
      ...state.districtsById["district:1"],
      id: "district:2",
      name: "Second District",
      ownerPlayerId: "player:1"
    };
    const modifiers = FACTION_DEFINITION_BY_ID.hackeri.passiveModifiers;
    const lowConfidenceRumor = resolveRumorEvent({
      sourceType: "building_action",
      playerId: "player:1",
      message: "Hackers verified the signal.",
      truthChancePct: 60
    }, state, { config: context.config, seed: "hacker-rumor" });
    const highConfidenceRumor = resolveRumorEvent({
      sourceType: "building_action",
      playerId: "player:1",
      message: "Hackers checked a high confidence signal.",
      truthChancePct: 80
    }, state, { config: context.config, seed: "hacker-rumor-high" });

    expect(applyFactionRumorTruthChancePct(60, modifiers)).toBe(90);
    expect(applyFactionRumorTruthChancePct(80, modifiers)).toBe(95);
    expect(lowConfidenceRumor.event).toBeTruthy();
    expect(Number(lowConfidenceRumor.event?.payload?.truthChancePct)).toBeLessThanOrEqual(95);
    expect(highConfidenceRumor.event).toBeTruthy();
    expect(Number(highConfidenceRumor.event?.payload?.truthChancePct)).toBe(95);
    expect(resolveFactionCameraEffectivenessMultiplier(modifiers)).toBeCloseTo(1.15);
    expect(resolveFactionAlarmEffectivenessMultiplier(modifiers)).toBeCloseTo(1.15);
    expect(resolveFactionBaseDefensePowerMultiplier(modifiers)).toBeCloseTo(0.95);
    expect(resolveFactionCameraEffectivenessMultiplier({})).toBe(1);
    expect(resolveFactionAlarmEffectivenessMultiplier({})).toBe(1);
    expect(resolveFactionBaseDefensePowerMultiplier({})).toBe(1);
    expect(applyFactionChanceBonus(0.72, modifiers.spySuccessChanceBonus)).toBeCloseTo(0.82);
    expect(validatePlaceTrap(state, {
      id: "command:trap:hacker-second",
      type: "place-trap",
      mode: "free",
      playerId: "player:1",
      serverInstanceId: "instance:1",
      issuedAt: new Date(0).toISOString(),
      clientRequestId: null,
      payload: { districtId: "district:2" }
    }).map((error) => error.code)).toContain("trap_limit_reached");
  });

  it("applies biker cooldown, robbery loot and aggressive heat modifiers through central helpers", () => {
    const modifiers = FACTION_DEFINITION_BY_ID["motorkarsky-gang"].passiveModifiers;

    expect(applyFactionCooldownTicks(100, "robbery", modifiers)).toBe(85);
    expect(applyFactionCooldownTicks(100, "attack", modifiers)).toBe(90);
    expect(applyFactionCooldownTicks(100, "occupy", modifiers)).toBe(90);
    expect(applyFactionRobberyDirtyCashLoot(100, modifiers)).toBe(110);
    expect(applyFactionAggressiveHeatGain(100, modifiers)).toBe(108);
    expect(applyFactionCooldownTicks(100, "attack", {})).toBe(100);
    expect(applyFactionRobberyDirtyCashLoot(100, {})).toBe(100);
    expect(applyFactionAggressiveHeatGain(100, {})).toBe(100);
  });

  it("applies cult population generation through a central helper and tolerates missing fields", () => {
    const modifiers = FACTION_DEFINITION_BY_ID.kult.passiveModifiers;

    expect(applyFactionPopulationGeneration(100, modifiers)).toBeCloseTo(110);
    expect(applyFactionPopulationGeneration(100, {})).toBe(100);
  });

  it("applies Korporat defense system and robbery loot modifiers through central helpers", () => {
    const modifiers = FACTION_DEFINITION_BY_ID.korporace.passiveModifiers;

    expect(applyFactionDefenseSystemEffectiveness(1, modifiers)).toBeCloseTo(1.1);
    expect(applyFactionRobberyLoot(100, modifiers)).toBe(90);
    expect(applyFactionDefenseSystemEffectiveness(1, {})).toBe(1);
    expect(applyFactionRobberyLoot(100, {})).toBe(100);
  });

  it("applies private army combat loss and aggressive heat modifiers through central helpers", () => {
    const modifiers = FACTION_DEFINITION_BY_ID["soukroma-armada"].passiveModifiers;

    expect(applyFactionAggressiveHeatGain(100, modifiers)).toBe(108);
    expect(applyFactionEquipmentLosses({ pistol: 2, smg: 1 }, modifiers)).toEqual({
      pistol: 1
    });
    expect(applyFactionEquipmentLosses({ pistol: 2 }, {})).toEqual({ pistol: 2 });
  });

  it("adds faction read model to player view", () => {
    const state = createCoreStateFixture();
    state.playersById["player:1"] = {
      ...state.playersById["player:1"],
      factionId: "mafian"
    };

    expect(createFactionReadModel(state, "player:1", context)).toMatchObject({
      factionId: "mafian",
      name: "Mafián",
      activePassiveEffects: expect.arrayContaining(["Clean income +10 %"]),
      plannedPassiveEffects: [],
      startingPackageSummary: [],
      specialAction: expect.objectContaining({
        name: "Tichá dohoda",
        status: "preview"
      })
    });
    expect(createPlayerView(state, "player:1", context).faction).toMatchObject({
      factionId: "mafian",
      tagline: "Staré peníze, staré krytí."
    });
  });

  it("separates active and planned faction passive effects in the read model", () => {
    const state = createCoreStateFixture();
    state.playersById["player:1"] = {
      ...state.playersById["player:1"],
      factionId: "korporace"
    };

    const readModel = createFactionReadModel(state, "player:1", context);

    expect(readModel?.activePassiveEffects).toEqual(expect.arrayContaining([
      "+15 % clean income",
      "-3 % heat gain",
      "+10 % efekt obranných systémů",
      "+10 % délka útoků"
    ]));
    expect(readModel?.plannedPassiveEffects).toEqual(expect.arrayContaining(["-10 % market fee"]));
    expect(readModel?.specialAction).toMatchObject({
      name: "Právní štít",
      status: "preview"
    });
  });

  it("resolves faction-aware bot behavior profiles", () => {
    expect(resolveFactionBotBehavior("tajna-organizace").spyTendency)
      .toBeGreaterThan(resolveFactionBotBehavior("soukroma-armada").spyTendency);
    expect(resolveFactionBotBehavior("motorkarsky-gang").attackTendency)
      .toBeGreaterThan(resolveFactionBotBehavior("korporace").attackTendency);
    expect(resolveFactionBotBehavior("unknown").factionId).toBe("mafian");
  });
});
