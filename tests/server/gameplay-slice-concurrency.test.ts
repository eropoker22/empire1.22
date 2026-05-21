import { describe, expect, it } from "vitest";
import { createServerApp } from "../../apps/server/src/app";
import { ensureGameplaySliceSessionResult } from "../../apps/server/src/bootstrap";
import { createPlaceTrapCommandFixture } from "../fixtures/command-fixtures";

describe("gameplay slice optimistic concurrency", () => {
  it("accepts commands with the current state version and returns advanced metadata", async () => {
    const server = createServerApp();
    const instanceId = "instance:free:concurrency:current";
    const playerId = "player:concurrency:current";
    const districtId = "district:concurrency:current";

    await ensureGameplaySliceSessionResult(server.instanceManager, {
      serverInstanceId: instanceId,
      playerId,
      districtId
    });

    const load = server.gameplaySliceTransport.load({
      serverInstanceId: instanceId,
      playerId,
      districtId
    });
    const confirmedDistrictId = load.readModel?.district?.districtId ?? districtId;
    const expectedStateVersion = load.metadata?.stateVersion;
    const response = server.gameplaySliceTransport.submit({
      sessionToken: load.sessionToken,
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

    await ensureGameplaySliceSessionResult(server.instanceManager, {
      serverInstanceId: instanceId,
      playerId,
      districtId
    });

    const load = server.gameplaySliceTransport.load({
      serverInstanceId: instanceId,
      playerId,
      districtId
    });
    const confirmedDistrictId = load.readModel?.district?.districtId ?? districtId;
    const staleStateVersion = load.metadata?.stateVersion ?? 0;
    const accepted = server.gameplaySliceTransport.submit({
      sessionToken: load.sessionToken,
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

    const stale = server.gameplaySliceTransport.submit({
      sessionToken: accepted.sessionToken,
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

  it("keeps duplicate command id rejection distinct from stale version rejection", async () => {
    const server = createServerApp();
    const instanceId = "instance:free:concurrency:duplicate";
    const playerId = "player:concurrency:duplicate";
    const districtId = "district:concurrency:duplicate";

    await ensureGameplaySliceSessionResult(server.instanceManager, {
      serverInstanceId: instanceId,
      playerId,
      districtId
    });

    const load = server.gameplaySliceTransport.load({
      serverInstanceId: instanceId,
      playerId,
      districtId
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
    const accepted = server.gameplaySliceTransport.submit({
      sessionToken: load.sessionToken,
      expectedStateVersion,
      focusDistrictId: confirmedDistrictId,
      command
    });
    const duplicate = server.gameplaySliceTransport.submit({
      sessionToken: accepted.sessionToken,
      expectedStateVersion,
      focusDistrictId: confirmedDistrictId,
      command
    });

    expect(accepted.errors).toEqual([]);
    expect(accepted.accepted).toBe(true);
    expect(duplicate.accepted).toBe(false);
    expect(duplicate.errors[0]?.code).toBe("server.duplicate_command");
  });
});
