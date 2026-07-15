import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";
import {
  applyCommand,
  createPlayerBoostView,
  resolveProductionLineDurationTicks,
  rescalePlayerProductionAtBoostBoundary,
  runTick
} from "@empire/game-core";
import type { ActivatePlayerBoostCommand, Building, PlayerBoostState } from "@empire/shared-types";
import {
  createAttackDistrictCommandFixture,
  createPlaceTrapCommandFixture,
  createSpyDistrictCommandFixture
} from "../../fixtures/command-fixtures";
import {
  createCombatStateFixture,
  createCoreStateFixture,
  createCoreStateWithFixedBuildingFixture,
  createFixedBuildingFixture
} from "../../fixtures/game-state-fixtures";

const config = resolveModeConfig("free");
const fixedNow = new Date("2026-07-14T12:00:00.000Z");
const context = {
  config,
  clock: {
    now: () => fixedNow,
    nowIso: () => fixedNow.toISOString()
  }
};

const command = (boostId: ActivatePlayerBoostCommand["payload"]["boostId"], id = `command:boost:${boostId}`): ActivatePlayerBoostCommand => ({
  id,
  type: "activate-player-boost",
  mode: "free",
  playerId: "player:1",
  serverInstanceId: "instance:1",
  issuedAt: new Date(0).toISOString(),
  clientRequestId: null,
  payload: { boostId }
});

const fundedState = () => {
  const state = createCoreStateFixture();
  state.resourceStatesById["resource:1"] = {
    ...state.resourceStatesById["resource:1"],
    balances: {
      cash: 50_000,
      "ghost-serum": 10,
      "pulse-shot": 10,
      "overdrive-x": 10,
      "combat-module": 10
    }
  };
  return state;
};

const armedGrid = (activatedAtTick = 0): PlayerBoostState => ({
  version: 1,
  active: {
    boostId: "tactical-grid",
    activatedAtTick,
    expiresAtTick: activatedAtTick + config.balance.playerBoosts!["tactical-grid"].activeDurationTicks,
    status: "armed",
    effectSnapshot: { combatPowerMultiplier: 1.12 }
  },
  cooldownUntilTickByBoostId: {
    "tactical-grid": activatedAtTick + config.balance.playerBoosts!["tactical-grid"].cooldownTicks
  }
});

describe("authoritative player boost flow", () => {
  it("atomically activates Ghost Network and projects server-owned state", () => {
    const state = fundedState();
    const result = applyCommand(state, command("ghost-network"), context);

    expect(result.errors).toEqual([]);
    expect(result.nextState.resourceStatesById["resource:1"].balances).toMatchObject({
      cash: 45_000,
      "ghost-serum": 8,
      "pulse-shot": 8,
      "overdrive-x": 10,
      "combat-module": 10
    });
    expect(result.nextState.playerBoostStatesByPlayerId?.["player:1"]?.active).toMatchObject({
      boostId: "ghost-network",
      status: "timed",
      activatedAtTick: 0,
      expiresAtTick: config.balance.playerBoosts!["ghost-network"].activeDurationTicks
    });
    expect(result.events.map((event) => event.type)).toContain("player-boost-activated");

    const view = createPlayerBoostView(result.nextState, "player:1", context)!;
    expect(view.active).toMatchObject({
      boostId: "ghost-network",
      status: "timed",
      effectSummary: "Špionáž −35 % času · rozšířený intel"
    });
    expect(view.active?.activatedAtMs).toBe(fixedNow.getTime());
    expect(view.active?.expiresAtMs).toBe(
      fixedNow.getTime() + config.balance.playerBoosts!["ghost-network"].activeDurationTicks * config.tickRateMs
    );
    expect(view.cards.find((card) => card.boostId === "ghost-network")).toMatchObject({
      isActive: true,
      canActivate: false,
      disabledReason: "boost_active"
    });
    expect(view.cards.find((card) => card.boostId === "industrial-overdrive")).toMatchObject({
      isBlockedByActiveBoost: true,
      canActivate: false,
      disabledReason: "boost_already_active"
    });
  });

  it("rejects missing resources and active/cooldown conflicts without partial mutation", () => {
    const missing = fundedState();
    missing.resourceStatesById["resource:1"].balances["pulse-shot"] = 1;
    const rejected = applyCommand(missing, command("ghost-network", "command:missing"), context);
    expect(rejected.errors.map((error) => error.code)).toEqual(["boost_missing_resources"]);
    expect(rejected.nextState).toBe(missing);

    const active = applyCommand(fundedState(), command("ghost-network", "command:active"), context);
    const blocked = applyCommand(active.nextState, command("industrial-overdrive", "command:blocked"), context);
    expect(blocked.errors.map((error) => error.code)).toEqual(["boost_already_active"]);
    expect(blocked.nextState).toBe(active.nextState);

    const cooldownState = fundedState();
    cooldownState.playerBoostStatesByPlayerId = {
      "player:1": {
        version: 1,
        active: null,
        cooldownUntilTickByBoostId: { "ghost-network": 50 }
      }
    };
    const cooldown = applyCommand(cooldownState, command("ghost-network", "command:cooldown"), context);
    expect(cooldown.errors.map((error) => error.code)).toEqual(["boost_on_cooldown"]);
    expect(cooldown.nextState).toBe(cooldownState);
  });

  it("applies Industrial Overdrive once to every production building and preserves boundaries", () => {
    const recipe = {
      durationTicksPerUnit: 1_000,
      outputAmount: 1,
      cleanCashCostPerUnit: 0,
      inputCosts: {},
      localOutputCap: 2,
      queueCap: 2
    };
    const state = fundedState();
    state.playerBoostStatesByPlayerId = {
      "player:1": {
        version: 1,
        active: {
          boostId: "industrial-overdrive",
          activatedAtTick: 40,
          expiresAtTick: 184,
          status: "timed",
          effectSnapshot: { productionSpeedMultiplier: 1.25 }
        },
        cooldownUntilTickByBoostId: { "industrial-overdrive": 580 }
      }
    };
    state.root.tick = 40;

    for (const buildingTypeId of ["pharmacy", "drug_lab", "factory", "armory"]) {
      const building = createFixedBuildingFixture(buildingTypeId);
      expect(resolveProductionLineDurationTicks(state, building, recipe, context)).toBe(640);
      expect(recipe).toMatchObject({ outputAmount: 1, localOutputCap: 2, queueCap: 2, inputCosts: {} });
    }

    const building: Building = createFixedBuildingFixture("factory", {
      productionLines: {
        "metal-parts": {
          recipeId: "metal-parts",
          queuedAmount: 1,
          activeStartedAtTick: 0,
          activeCompletesAtTick: 1_000,
          reservedCleanCash: 300,
          unitCleanCashCost: 300,
          version: 1
        }
      }
    });
    state.buildingsById[building.id] = building;
    const activatedBoundary = rescalePlayerProductionAtBoostBoundary(state, "player:1", 40, 1, 1.25);
    expect(activatedBoundary.buildingsById[building.id].productionLines?.["metal-parts"].activeCompletesAtTick)
      .toBe(808);
    const expiredBoundary = rescalePlayerProductionAtBoostBoundary(activatedBoundary, "player:1", 184, 1.25, 1);
    expect(expiredBoundary.buildingsById[building.id].productionLines?.["metal-parts"].activeCompletesAtTick)
      .toBe(964);
  });

  it("snapshots Ghost Network into spy resolution and leaves pre-activation missions unaffected", () => {
    const findSuccessful = (withBoost: boolean) => Array.from({ length: 400 }, (_, index) => {
      const state = createCombatStateFixture();
      state.serverInstance.worldSeed = `boost-spy-success-${index}`;
      if (withBoost) {
        state.playerBoostStatesByPlayerId = {
          "player:1": {
            version: 1,
            active: {
              boostId: "ghost-network",
              activatedAtTick: 0,
              expiresAtTick: 1_000,
              status: "timed",
              effectSnapshot: {
                spyDurationMultiplier: 0.65,
                criticalFailureChanceMultiplier: 0.75,
                extraIntelBlocksOnSuccess: 1
              }
            },
            cooldownUntilTickByBoostId: {}
          }
        };
      }
      return applyCommand(state, createSpyDistrictCommandFixture(), context);
    }).find((candidate) => candidate.nextState.notificationsById["notification:command:spy:1:spy-report"]?.payload.result === "success");

    const boosted = findSuccessful(true)!;
    const report = boosted.nextState.notificationsById["notification:command:spy:1:spy-report"];
    expect(report.payload).toMatchObject({
      boostSnapshot: {
        boostId: "ghost-network",
        spyDurationMultiplier: 0.65,
        criticalFailureChanceMultiplier: 0.75,
        extraIntelBlocksOnSuccess: 1
      },
      extraIntelBlocks: [{ category: "security-profile" }]
    });
    const boostedCooldown = boosted.nextState.cooldownStatesById["cooldown:1"].cooldowns["spy:district:2"];

    const unboosted = findSuccessful(false)!;
    const unboostedCooldown = unboosted.nextState.cooldownStatesById["cooldown:1"].cooldowns["spy:district:2"];
    expect(boostedCooldown).toBe(Math.ceil(unboostedCooldown * 0.65));
    expect(unboosted.nextState.notificationsById["notification:command:spy:1:spy-report"].payload.extraIntelBlocks)
      .toEqual([]);
  });

  it("consumes Tactical Grid for both players only after a valid PvP resolution", () => {
    const state = createCombatStateFixture();
    state.playerBoostStatesByPlayerId = {
      "player:1": armedGrid(),
      "player:2": armedGrid()
    };
    const resolved = applyCommand(state, createAttackDistrictCommandFixture(), context);

    expect(resolved.errors).toEqual([]);
    expect(resolved.nextState.playerBoostStatesByPlayerId?.["player:1"]?.active).toBeNull();
    expect(resolved.nextState.playerBoostStatesByPlayerId?.["player:2"]?.active).toBeNull();
    expect(resolved.events.filter((event) => event.type === "player-boost-consumed")).toHaveLength(2);
    expect(resolved.events.find((event) => event.type === "district-attacked")?.payload).toMatchObject({
      tacticalGridAttackerMultiplier: 1.12,
      tacticalGridDefenderMultiplier: 1.12
    });
    expect(resolved.nextState.notificationsById["notification:command:attack:1:battle:player:1"].payload)
      .toMatchObject({ tacticalGridSummary: "Tactical Grid: +12 % bojové síly" });

    const invalid = createCombatStateFixture();
    invalid.playerBoostStatesByPlayerId = { "player:1": armedGrid() };
    invalid.districtsById["district:1"].adjacentDistrictIds = [];
    const rejected = applyCommand(invalid, createAttackDistrictCommandFixture(), context);
    expect(rejected.errors.length).toBeGreaterThan(0);
    expect(rejected.nextState.playerBoostStatesByPlayerId?.["player:1"]?.active?.boostId)
      .toBe("tactical-grid");

    const neutral = createCombatStateFixture();
    neutral.playerBoostStatesByPlayerId = { "player:1": armedGrid() };
    neutral.districtsById["district:2"].ownerPlayerId = "player:neutral";
    const neutralResult = applyCommand(neutral, createAttackDistrictCommandFixture(), context);
    expect(neutralResult.nextState.playerBoostStatesByPlayerId?.["player:1"]?.active?.boostId)
      .toBe("tactical-grid");
    expect(neutralResult.events.filter((event) => event.type === "player-boost-consumed"))
      .toHaveLength(0);
  });

  it("keeps Tactical Grid armed when a toxic trap blocks actual PvP combat", () => {
    const trappedConfig = {
      ...config,
      balance: {
        ...config.balance,
        conflict: { ...config.balance.conflict!, trapAttackLosses: 999 }
      }
    };
    const trappedContext = { ...context, config: trappedConfig };
    const state = createCombatStateFixture();
    state.playerBoostStatesByPlayerId = {
      "player:1": armedGrid(),
      "player:2": armedGrid()
    };
    const withTrap = applyCommand(state, createPlaceTrapCommandFixture(), trappedContext).nextState;
    const blocked = applyCommand(withTrap, createAttackDistrictCommandFixture(), trappedContext);

    expect(blocked.errors).toEqual([]);
    expect(blocked.nextState.playerBoostStatesByPlayerId?.["player:1"]?.active?.boostId).toBe("tactical-grid");
    expect(blocked.nextState.playerBoostStatesByPlayerId?.["player:2"]?.active?.boostId).toBe("tactical-grid");
    expect(blocked.events.filter((event) => event.type === "player-boost-consumed")).toHaveLength(0);
    expect(blocked.nextState.notificationsById["notification:command:attack:1:battle:player:1"].payload.tacticalGridSummary).toBeNull();
  });

  it("expires an unused Tactical Grid once while keeping its original cooldown", () => {
    const definition = config.balance.playerBoosts!["tactical-grid"];
    const state = fundedState();
    state.root.tick = definition.activeDurationTicks - 1;
    state.serverInstance.currentTick = definition.activeDurationTicks - 1;
    state.playerBoostStatesByPlayerId = { "player:1": armedGrid() };

    const expired = runTick(state, context);
    expect(expired.nextState.playerBoostStatesByPlayerId?.["player:1"]).toMatchObject({
      active: null,
      cooldownUntilTickByBoostId: {
        "tactical-grid": definition.cooldownTicks
      }
    });
    expect(expired.events.filter((event) => event.type === "player-boost-expired"))
      .toHaveLength(1);
    expect(Object.values(expired.nextState.notificationsById).some((notification) =>
      notification.title === "Tactical Grid expiroval bez použití."
    )).toBe(true);

    const repeated = runTick(expired.nextState, context);
    expect(repeated.events.filter((event) => event.type === "player-boost-expired"))
      .toHaveLength(0);
    expect(repeated.nextState.playerBoostStatesByPlayerId?.["player:1"]?.cooldownUntilTickByBoostId)
      .toEqual(expired.nextState.playerBoostStatesByPlayerId?.["player:1"]?.cooldownUntilTickByBoostId);
  });

  it("starts a successor at normal speed when Industrial Overdrive expires on completion", () => {
    const definition = config.balance.playerBoosts!["industrial-overdrive"];
    const expiresAtTick = definition.activeDurationTicks;
    const { state, building } = createCoreStateWithFixedBuildingFixture("factory", {
      productionResourceKey: "metal-parts",
      productionStoredAmount: 0,
      buildingOverrides: {
        productionLines: {
          "metal-parts": {
            recipeId: "metal-parts",
            queuedAmount: 2,
            activeStartedAtTick: 0,
            activeCompletesAtTick: expiresAtTick,
            reservedCleanCash: 600,
            unitCleanCashCost: 300,
            version: 1
          }
        }
      }
    });
    state.root.tick = expiresAtTick - 1;
    state.serverInstance.currentTick = expiresAtTick - 1;
    state.playerBoostStatesByPlayerId = {
      "player:1": {
        version: 1,
        active: {
          boostId: "industrial-overdrive",
          activatedAtTick: 0,
          expiresAtTick,
          status: "timed",
          effectSnapshot: { productionSpeedMultiplier: 1.25 }
        },
        cooldownUntilTickByBoostId: { "industrial-overdrive": definition.cooldownTicks }
      }
    };

    const advanced = runTick(state, context).nextState;
    const line = advanced.buildingsById[building.id].productionLines?.["metal-parts"];
    const recipe = config.balance.factory!.recipes["metal-parts"];
    const normalDuration = resolveProductionLineDurationTicks(
      advanced,
      advanced.buildingsById[building.id],
      recipe,
      context
    );

    expect(advanced.playerBoostStatesByPlayerId?.["player:1"]?.active).toBeNull();
    expect(advanced.resourceStatesById[`resource:${building.id}`].balances["metal-parts"]).toBe(1);
    expect(line?.queuedAmount).toBe(1);
    expect(line?.activeStartedAtTick).toBe(expiresAtTick);
    expect(Number(line?.activeCompletesAtTick) - expiresAtTick).toBe(normalDuration);
  });
});
