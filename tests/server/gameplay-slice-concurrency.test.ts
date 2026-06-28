import { describe, expect, it } from "vitest";
import { createServerApp } from "../../apps/server/src/app";
import { createPlaceTrapCommandFixture } from "../fixtures/command-fixtures";
import { loadWithDevGameplaySession } from "../helpers/gameplay-session-test-helpers";

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

  it("rejects stale expectedStateVersion while returning the current read model and metadata", async () => {
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
    expect(stale.errors[0]).toMatchObject({
      code: "server.state_version_conflict",
      details: {
        expectedStateVersion: staleStateVersion,
        currentStateVersion: accepted.metadata?.stateVersion
      }
    });
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
});
