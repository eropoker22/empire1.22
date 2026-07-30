import { describe, expect, it } from "vitest";
import { applyCommand, createInitialState, createPlayerView } from "@empire/game-core";
import {
  copyFreeHostedStartingPlayerState,
  FREE_HOSTED_STARTING_MATERIAL_IDS,
  resolveModeConfig
} from "@empire/game-config";
import { ensureGameplaySliceMembershipInState } from "../../apps/server/src/bootstrap/gameplay-slice-session-membership";
import { SHARED_CITY_TOTAL_DISTRICT_COUNT } from "../../apps/server/src/bootstrap/gameplay-slice-shared-city-seed";
import { createRunBuildingActionCommandFixture } from "../fixtures/command-fixtures";

const context = {
  config: resolveModeConfig("free")
};

describe("gameplay slice session membership", () => {
  it("advances the snapshot version once for an idempotent player join", () => {
    const state = createInitialState("instance:membership-version", "free");
    const initialVersion = state.root.version;
    const request = {
      serverInstanceId: "instance:membership-version",
      playerId: "player:membership-version",
      factionId: "mafian",
      mode: "free"
    } as const;

    const firstJoin = ensureGameplaySliceMembershipInState(state, request);
    expect(firstJoin.accepted).toBe(true);
    expect(firstJoin.joinedPlayer).toBe(true);
    expect(firstJoin.stateChanged).toBe(true);
    expect(firstJoin.state.root.version).toBe(initialVersion + 1);

    const repeatedJoin = ensureGameplaySliceMembershipInState(firstJoin.state, request);
    expect(repeatedJoin.accepted).toBe(true);
    expect(repeatedJoin.joinedPlayer).toBe(false);
    expect(repeatedJoin.stateChanged).toBe(false);
    expect(repeatedJoin.state.root.version).toBe(initialVersion + 1);
  });

  it("repairs partial shared city entities and indexes before returning an existing membership", () => {
    const state = createInitialState("instance:membership-map-repair", "free");
    const request = {
      serverInstanceId: "instance:membership-map-repair",
      playerId: "player:membership-map-repair",
      factionId: "mafian",
      mode: "free"
    } as const;
    const firstJoin = ensureGameplaySliceMembershipInState(state, request);
    const versionBeforeRepair = firstJoin.state.root.version;
    const missingEntityId = firstJoin.state.root.districtIds[0]!;
    const missingIndexId = firstJoin.state.root.districtIds[1]!;

    delete firstJoin.state.districtsById[missingEntityId];
    firstJoin.state.root.districtIds = firstJoin.state.root.districtIds
      .filter((districtId) => districtId !== missingIndexId);

    const repairedJoin = ensureGameplaySliceMembershipInState(firstJoin.state, request);

    expect(repairedJoin.accepted).toBe(true);
    expect(repairedJoin.joinedPlayer).toBe(false);
    expect(repairedJoin.stateChanged).toBe(true);
    expect(repairedJoin.state.root.districtIds).toHaveLength(SHARED_CITY_TOTAL_DISTRICT_COUNT);
    expect(repairedJoin.state.districtsById[missingEntityId]).toBeDefined();
    expect(repairedJoin.state.root.districtIds).toContain(missingIndexId);
    expect(repairedJoin.state.root.version).toBe(versionBeforeRepair + 1);

    const repeatedJoin = ensureGameplaySliceMembershipInState(repairedJoin.state, request);
    expect(repeatedJoin.stateChanged).toBe(false);
    expect(repeatedJoin.state.root.version).toBe(versionBeforeRepair + 1);
  });

  it("applies server-owned cash, population, materials and exactly two spy slots", () => {
    const state = createInitialState("instance:membership-starting-state", "free");
    const startingPlayerState = copyFreeHostedStartingPlayerState();
    startingPlayerState.cleanCash = 88_000;
    startingPlayerState.dirtyCash = 12_000;
    startingPlayerState.population = 250;
    startingPlayerState.materials.chemicals = 33;
    startingPlayerState.materials["stim-pack"] = 7;
    startingPlayerState.materials.pistol = 5;
    startingPlayerState.materials.smg = 0;

    const joined = ensureGameplaySliceMembershipInState(state, {
      serverInstanceId: "instance:membership-starting-state",
      playerId: "player:membership-starting-state",
      factionId: "mafian",
      mode: "free",
      startingPlayerState
    });

    expect(joined.accepted).toBe(true);
    const player = joined.state.playersById["player:membership-starting-state"]!;
    expect(joined.state.resourceStatesById[player.resourceStateId]?.balances).toMatchObject({
      cash: 88_000,
      "dirty-cash": 12_000,
      chemicals: 33,
      "stim-pack": 7,
      pistol: 5,
      smg: 0
    });
    expect(joined.state.resourceStatesById[player.resourceStateId]?.balances.population).toBeUndefined();
    expect(player.population).toBe(250);
    expect(createPlayerView(joined.state, player.id, context)).toMatchObject({
      resourceBalances: {
        population: 250
      },
      economy: {
        population: 250
      }
    });
    expect(player.attackLoadout).toMatchObject({ pistol: 5, smg: 0 });
    expect(joined.state.playerSpyOperationStatesByPlayerId?.[player.id]?.slots).toEqual([
      { slotId: "spy-1", availableAtTick: 0, lastMissionId: null },
      { slotId: "spy-2", availableAtTick: 0, lastMissionId: null }
    ]);
  });

  it("preserves every canonical starting material by key including zero", () => {
    const state = createInitialState("instance:membership-all-materials", "free");
    const startingPlayerState = copyFreeHostedStartingPlayerState();
    const expectedMaterials = Object.fromEntries(
      FREE_HOSTED_STARTING_MATERIAL_IDS.map((materialId, index) => [
        materialId,
        index * 11
      ])
    ) as typeof startingPlayerState.materials;
    startingPlayerState.cleanCash = 123_456;
    startingPlayerState.dirtyCash = 23_456;
    startingPlayerState.population = 345;
    startingPlayerState.materials = expectedMaterials;

    const joined = ensureGameplaySliceMembershipInState(state, {
      serverInstanceId: "instance:membership-all-materials",
      playerId: "player:membership-all-materials",
      factionId: "mafian",
      mode: "free",
      startingPlayerState
    });

    expect(joined.accepted).toBe(true);
    const player = joined.state.playersById["player:membership-all-materials"]!;
    const balances = joined.state.resourceStatesById[player.resourceStateId]!.balances;
    expect(Object.fromEntries(
      FREE_HOSTED_STARTING_MATERIAL_IDS.map((materialId) => [
        materialId,
        balances[materialId]
      ])
    )).toEqual(expectedMaterials);
    expect(balances).toMatchObject({
      cash: 123_456,
      "dirty-cash": 23_456
    });
    expect(balances.population).toBeUndefined();
    expect(player.population).toBe(345);
  });

  it("preserves configured population through projection and a subsequent population collect", () => {
    const state = createInitialState("instance:membership-population-collect", "free");
    const startingPlayerState = copyFreeHostedStartingPlayerState();
    startingPlayerState.population = 250;
    const playerId = "player:membership-population-collect";
    const joined = ensureGameplaySliceMembershipInState(state, {
      serverInstanceId: "instance:membership-population-collect",
      playerId,
      factionId: "mafian",
      mode: "free",
      startingPlayerState
    });
    const apartment = Object.values(joined.state.buildingsById)
      .find((building) => building.buildingTypeId === "apartment_block");

    expect(apartment).toBeDefined();
    const district = joined.state.districtsById[apartment!.districtId]!;
    const player = joined.state.playersById[playerId]!;
    joined.state.playersById[playerId] = {
      ...player,
      homeDistrictId: district.id,
      metadata: {
        ...(player.metadata ?? {}),
        spawnSelectionStatus: "ready_to_play"
      },
      version: player.version + 1
    };
    joined.state.districtsById[district.id] = {
      ...district,
      ownerPlayerId: playerId,
      status: "claimed",
      version: district.version + 1
    };
    joined.state.buildingsById[apartment!.id] = {
      ...apartment!,
      ownerPlayerId: playerId,
      metadata: {
        apartmentBlock: {
          storedPopulation: 10,
          lastUpdatedTick: joined.state.root.tick,
          lastCapacity: 50,
          wasFull: false
        }
      },
      version: apartment!.version + 1
    };

    expect(createPlayerView(joined.state, playerId, context).economy.population).toBe(250);

    const collected = applyCommand(
      joined.state,
      createRunBuildingActionCommandFixture({
        id: "command:membership-population-collect",
        playerId,
        serverInstanceId: "instance:membership-population-collect",
        payload: {
          districtId: district.id,
          buildingId: apartment!.id,
          actionId: "collect_population"
        }
      }),
      context
    );

    expect(collected.errors).toEqual([]);
    expect(collected.nextState.playersById[playerId]?.population).toBe(260);
    expect(collected.nextState.resourceStatesById[`resource:${playerId}`]?.balances.population).toBeUndefined();
    expect(createPlayerView(collected.nextState, playerId, context)).toMatchObject({
      resourceBalances: {
        population: 260,
        "gang-members": 10
      },
      economy: {
        population: 260,
        gangMembers: 10
      }
    });
  });
});
