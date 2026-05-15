import { describe, expect, it } from "vitest";
import {
  applyFactionHeatGain,
  applyFactionStartingPackage,
  calculateIncomeByPlayerId,
  completeProduction,
  createFactionReadModel,
  createPlayerView,
  getFactionPassiveModifiers,
  normalizeFactionId
} from "@empire/game-core";
import {
  FACTION_DEFINITION_BY_ID,
  FACTION_DEFINITIONS,
  LEGACY_FACTION_ID_MAP,
  resolveModeConfig
} from "@empire/game-config";
import { PLAYER_FACTION_IDS } from "@empire/shared-types";
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
        passiveModifiers: expect.any(Object),
        startingPackage: expect.any(Object)
      });
    }
  });

  it("maps legacy faction ids to canonical ids and safely falls back", () => {
    expect(LEGACY_FACTION_ID_MAP.mafia).toBe("mafian");
    expect(LEGACY_FACTION_ID_MAP.cartel).toBe("kartel");
    expect(normalizeFactionId("hackers", context.config)).toBe("mafian");
    expect(normalizeFactionId("unknown", context.config)).toBe("mafian");
  });

  it("keeps starting packages inside free-mode balance range", () => {
    for (const definition of FACTION_DEFINITIONS) {
      const pack = definition.startingPackage;
      expect(pack.cash ?? 0).toBeLessThanOrEqual(500);
      expect(pack.dirtyCash ?? 0).toBeLessThanOrEqual(250);
      expect(pack.initialHeat ?? 0).toBeLessThanOrEqual(8);
      expect(pack.initialInfluence ?? 0).toBeLessThanOrEqual(20);
    }
  });

  it("applies starting package into authoritative server state", () => {
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
      cash: 1100,
      "dirty-cash": 180,
      chemicals: 3
    });
    expect(nextState.playersById["player:1"].attackLoadout.pistol).toBe(1);
    expect(nextState.policeStatesById["police:1"].heat).toBe(3);
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
    expect(income["dirty-cash"]).toBe(92);
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

  it("applies heat and spy modifiers only through core helpers", () => {
    const state = createCoreStateFixture();
    state.playersById["player:1"] = {
      ...state.playersById["player:1"],
      factionId: "tajna-organizace"
    };
    const modifiers = getFactionPassiveModifiers(state, "player:1", context);

    expect(applyFactionHeatGain(100, modifiers)).toBe(92);
    expect(modifiers.spySuccessChanceBonus).toBe(0.1);
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
      activePassiveEffects: expect.arrayContaining(["Clean income +10 %"])
    });
    expect(createPlayerView(state, "player:1", context).faction).toMatchObject({
      factionId: "mafian",
      tagline: "Staré peníze, staré krytí."
    });
  });
});
