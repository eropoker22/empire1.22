import { describe, expect, it } from "vitest";
import { createServerApp } from "../../apps/server/src/app";
import { createAttackDistrictCommandFixture, createPlaceTrapCommandFixture } from "../fixtures/command-fixtures";
import {
  createCombatStateFixture,
  createDistrictFixture,
  createPlayerFixture,
  createResourceStateFixture,
  seedSuccessfulSpyIntel
} from "../fixtures/game-state-fixtures";
import {
  createDevGameplaySession,
  loadWithDevGameplaySession
} from "../helpers/gameplay-session-test-helpers";

describe("gameplay slice optimistic concurrency", () => {
  it("accepts commands with the current state version and returns advanced metadata", async () => {
    const server = createServerApp();
    const instanceId = "instance:free:concurrency:current";
    const playerId = "player:concurrency:current";
    const districtId = "district:concurrency:current";

    const { response: load, sessionToken } = await loadWithDevGameplaySession(server, {
      serverInstanceId: instanceId,
      playerId,
      districtId,
      autoSelectSpawn: true
    });
    const confirmedDistrictId = load.readModel?.district?.districtId ?? districtId;
    const expectedStateVersion = load.metadata?.stateVersion;
    const response = await server.gameplaySliceTransport.submit({
      sessionToken,
      expectedStateVersion,
      focusDistrictId: confirmedDistrictId,
      command: createPlaceTrapCommandFixture({
        id: "command:concurrency:current:1",
        playerId,
        serverInstanceId: instanceId,
        payload: {
          districtId: confirmedDistrictId
        }
      })
    });

    expect(response.errors).toEqual([]);
    expect(response.accepted).toBe(true);
    expect(response.metadata?.stateVersion).toBeGreaterThan(expectedStateVersion ?? 0);
  });

  it("revalidates conflict commands against current state instead of rejecting on global version", async () => {
    const server = createServerApp();
    const instanceId = "instance:free:concurrency:stale";
    const playerId = "player:concurrency:stale";
    const districtId = "district:concurrency:stale";

    const { response: load, sessionToken } = await loadWithDevGameplaySession(server, {
      serverInstanceId: instanceId,
      playerId,
      districtId,
      autoSelectSpawn: true
    });
    const confirmedDistrictId = load.readModel?.district?.districtId ?? districtId;
    const staleStateVersion = load.metadata?.stateVersion ?? 0;
    const accepted = await server.gameplaySliceTransport.submit({
      sessionToken,
      expectedStateVersion: staleStateVersion,
      focusDistrictId: confirmedDistrictId,
      command: createPlaceTrapCommandFixture({
        id: "command:concurrency:stale:accepted",
        playerId,
        serverInstanceId: instanceId,
        payload: {
          districtId: confirmedDistrictId
        }
      })
    });

    expect(accepted.errors).toEqual([]);
    expect(accepted.accepted).toBe(true);

    const stale = await server.gameplaySliceTransport.submit({
      sessionToken,
      expectedStateVersion: staleStateVersion,
      focusDistrictId: confirmedDistrictId,
      command: createPlaceTrapCommandFixture({
        id: "command:concurrency:stale:rejected",
        playerId,
        serverInstanceId: instanceId,
        payload: {
          districtId: confirmedDistrictId
        }
      })
    });

    expect(stale.accepted).toBe(false);
    expect(stale.errors[0]?.code).toBe("trap_already_active");
    expect(stale.readModel?.player.playerId).toBe(playerId);
    expect(stale.metadata?.stateVersion).toBe(accepted.metadata?.stateVersion);
  });

  it("keeps duplicate command id replay distinct from stale version rejection", async () => {
    const server = createServerApp();
    const instanceId = "instance:free:concurrency:duplicate";
    const playerId = "player:concurrency:duplicate";
    const districtId = "district:concurrency:duplicate";

    const { response: load, sessionToken } = await loadWithDevGameplaySession(server, {
      serverInstanceId: instanceId,
      playerId,
      districtId,
      autoSelectSpawn: true
    });
    const confirmedDistrictId = load.readModel?.district?.districtId ?? districtId;
    const expectedStateVersion = load.metadata?.stateVersion;
    const command = createPlaceTrapCommandFixture({
      id: "command:concurrency:duplicate:1",
      playerId,
      serverInstanceId: instanceId,
      payload: {
        districtId: confirmedDistrictId
      }
    });
    const accepted = await server.gameplaySliceTransport.submit({
      sessionToken,
      expectedStateVersion,
      focusDistrictId: confirmedDistrictId,
      command
    });
    const duplicate = await server.gameplaySliceTransport.submit({
      sessionToken,
      expectedStateVersion: accepted.metadata?.stateVersion,
      focusDistrictId: confirmedDistrictId,
      command
    });

    expect(accepted.errors).toEqual([]);
    expect(accepted.accepted).toBe(true);
    expect(duplicate.accepted).toBe(true);
    expect(duplicate.errors).toEqual([]);
    expect(duplicate.commandResult?.commandId).toBe(command.id);
    expect(duplicate.commandResult?.status).toBe("applied");
    expect(duplicate.metadata?.stateVersion).toBe(accepted.metadata?.stateVersion);
  });

  it("rejects duplicate command ids with a different payload before state mutation", async () => {
    const server = createServerApp();
    const instanceId = "instance:free:concurrency:payload-conflict";
    const playerId = "player:concurrency:payload-conflict";
    const districtId = "district:concurrency:payload-conflict";

    const { response: load, sessionToken } = await loadWithDevGameplaySession(server, {
      serverInstanceId: instanceId,
      playerId,
      districtId,
      autoSelectSpawn: true
    });
    const confirmedDistrictId = load.readModel?.district?.districtId ?? districtId;
    const expectedStateVersion = load.metadata?.stateVersion;
    const command = createPlaceTrapCommandFixture({
      id: "command:concurrency:payload-conflict:1",
      playerId,
      serverInstanceId: instanceId,
      payload: {
        districtId: confirmedDistrictId
      }
    });
    const accepted = await server.gameplaySliceTransport.submit({
      sessionToken,
      expectedStateVersion,
      focusDistrictId: confirmedDistrictId,
      command
    });
    const rootAfterAccepted = server.instanceManager.getInstanceById(instanceId)!.state.root.version;
    const conflict = await server.gameplaySliceTransport.submit({
      sessionToken,
      expectedStateVersion: accepted.metadata?.stateVersion,
      focusDistrictId: confirmedDistrictId,
      command: {
        ...command,
        payload: {
          districtId: "district:payload-conflict:changed"
        }
      }
    });

    expect(accepted.accepted).toBe(true);
    expect(conflict.accepted).toBe(false);
    expect(conflict.errors[0]?.code).toBe("server.command_payload_conflict");
    expect(server.instanceManager.getInstanceById(instanceId)!.state.root.version).toBe(rootAfterAccepted);
  });

  it("serializes three authenticated same-target attacks through atomic transport ingress", async () => {
    const server = createServerApp();
    const instanceId = "instance:free:concurrency:attack-race";
    const sessions = await Promise.all(["player:1", "player:3", "player:4"].map((playerId) =>
      createDevGameplaySession(server, { serverInstanceId: instanceId, playerId })
    ));
    const runtime = server.instanceManager.getInstanceById(instanceId)!;
    const state = createCombatStateFixture();
    state.serverInstance = { ...state.serverInstance, id: instanceId };
    state.root.version = 100;
    state.playersById["player:2"] = { ...state.playersById["player:2"], lastStandUsedAtTick: 0 };
    state.districtsById["district:2"] = { ...state.districtsById["district:2"], defenseLoadout: {} };
    configureAttacker(state, "player:1", "district:1");
    addAttacker(state, "player:3", "district:3", "district:2");
    addAttacker(state, "player:4", "district:4", "district:2");
    runtime.state = state;

    const expectedConflictRevision = state.districtsById["district:2"].conflictRevision;
    const commands = [
      ["player:1", "district:1"],
      ["player:3", "district:3"],
      ["player:4", "district:4"]
    ].map(([playerId, sourceDistrictId], index) => createAttackDistrictCommandFixture({
      id: `command:transport:attack-race:${index + 1}`,
      playerId,
      serverInstanceId: instanceId,
      payload: {
        districtId: "district:2",
        sourceDistrictId,
        weapons: { bazooka: 10 },
        expectedConflictRevision
      }
    }));
    const resourcesBefore = Object.fromEntries(["player:1", "player:3", "player:4"].map((playerId) => [
      playerId,
      JSON.stringify(state.resourceStatesById[state.playersById[playerId].resourceStateId])
    ]));

    const responses = await Promise.all(commands.map((command, index) =>
      server.gameplaySliceTransport.submit({
        sessionToken: sessions[index]!.sessionToken,
        expectedStateVersion: state.root.version,
        focusDistrictId: command.payload.sourceDistrictId ?? "district:1",
        command
      })
    ));

    expect(responses.filter((response) => response.accepted)).toHaveLength(1);
    expect(responses.filter((response) => !response.accepted).map((response) => response.errors[0]?.code))
      .toEqual(["DISTRICT_CONFLICT_STATE_CHANGED", "DISTRICT_CONFLICT_STATE_CHANGED"]);
    const acceptedPlayerId = commands[responses.findIndex((response) => response.accepted)]!.playerId;
    for (const playerId of ["player:1", "player:3", "player:4"]) {
      if (playerId === acceptedPlayerId) continue;
      expect(JSON.stringify(runtime.state.resourceStatesById[runtime.state.playersById[playerId].resourceStateId]))
        .toBe(resourcesBefore[playerId]);
    }
    expect(runtime.state.districtsById["district:2"].attackProtectedUntilTick).toBeGreaterThan(0);
    await expect(server.instanceManager.listCommandRecords(instanceId)).resolves.toHaveLength(3);
    await expect(server.instanceManager.listEventRecords(instanceId)).resolves.toHaveLength(1);
  });
});

const configureAttacker = (state: ReturnType<typeof createCombatStateFixture>, playerId: string, sourceDistrictId: string) => {
  const player = state.playersById[playerId];
  state.playersById[playerId] = { ...player, population: 500, attackLoadout: { bazooka: 10 } };
  state.resourceStatesById[player.resourceStateId] = {
    ...state.resourceStatesById[player.resourceStateId],
    balances: { ...state.resourceStatesById[player.resourceStateId].balances, population: 500, bazooka: 10 }
  };
  seedSuccessfulSpyIntel(state, playerId, sourceDistrictId, "district:2", "player:2");
};

const addAttacker = (
  state: ReturnType<typeof createCombatStateFixture>,
  playerId: string,
  sourceDistrictId: string,
  targetDistrictId: string
) => {
  const suffix = playerId.split(":").at(-1)!;
  const resourceStateId = `resource:${playerId}`;
  const cooldownStateId = `cooldown:${playerId}`;
  const policeStateId = `police:${playerId}`;
  state.playersById[playerId] = createPlayerFixture({
    id: playerId,
    accountId: `account:${suffix}`,
    homeDistrictId: sourceDistrictId,
    resourceStateId,
    cooldownStateId,
    policeStateId,
    population: 500,
    attackLoadout: { bazooka: 10 }
  });
  state.resourceStatesById[resourceStateId] = createResourceStateFixture({
    id: resourceStateId,
    ownerType: "player",
    ownerId: playerId,
    balances: { cash: 1_000, population: 500, bazooka: 10 }
  });
  state.cooldownStatesById[cooldownStateId] = {
    id: cooldownStateId,
    ownerType: "player",
    ownerId: playerId,
    cooldowns: {},
    version: 1
  };
  state.policeStatesById[policeStateId] = {
    id: policeStateId,
    ownerPlayerId: playerId,
    heat: 0,
    wantedLevel: 0,
    lastDecayTick: 0,
    activeFlags: [],
    version: 1
  };
  state.districtsById[sourceDistrictId] = createDistrictFixture({
    id: sourceDistrictId,
    ownerPlayerId: playerId,
    adjacentDistrictIds: [targetDistrictId]
  });
  state.districtsById[targetDistrictId].adjacentDistrictIds = [
    ...new Set([...state.districtsById[targetDistrictId].adjacentDistrictIds, sourceDistrictId])
  ];
  state.root.playerIds.push(playerId);
  state.root.districtIds.push(sourceDistrictId);
  seedSuccessfulSpyIntel(state, playerId, sourceDistrictId, targetDistrictId, state.districtsById[targetDistrictId].ownerPlayerId);
};
