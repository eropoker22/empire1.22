import { describe, expect, it } from "vitest";
import { sharedCitySpawnDistrictIds } from "../../apps/server/src/bootstrap/gameplay-slice-shared-city-seed";
import { createServerApp } from "../../apps/server/src/app";
import { createDevGameplaySession } from "../helpers/gameplay-session-test-helpers";

describe("gameplay command result lookup", () => {
  it("returns the persisted applied result only to the command owner", async () => {
    const server = createServerApp();
    const instanceId = "instance:command-result:lookup";
    const owner = await createDevGameplaySession(server, {
      serverInstanceId: instanceId,
      playerId: "player:lookup-owner",
      autoSelectSpawn: false
    });
    const runtime = server.instanceManager.getInstanceById(instanceId);
    const districtId = sharedCitySpawnDistrictIds
      .find((candidateId) => !runtime?.state.districtsById[candidateId]?.ownerPlayerId);
    expect(districtId).toBeTruthy();
    const command = {
      id: "command:lookup:applied",
      type: "select-spawn-district" as const,
      mode: runtime!.record.mode,
      playerId: "player:lookup-owner",
      serverInstanceId: instanceId,
      issuedAt: new Date(0).toISOString(),
      payload: { districtId: districtId! },
      clientRequestId: null
    };
    const submitted = await server.gameplaySliceTransport.submit({
      sessionToken: owner.sessionToken,
      focusDistrictId: districtId!,
      command
    });
    expect(submitted.errors).toEqual([]);
    expect(submitted.accepted).toBe(true);

    const lookup = await server.gameplaySliceTransport.lookupCommandResult?.({
      sessionToken: owner.sessionToken,
      serverInstanceId: instanceId,
      commandId: command.id,
      districtId: districtId!
    });
    expect(lookup).toMatchObject({
      accepted: true,
      status: "applied",
      commandResult: { commandId: command.id, status: "applied" }
    });

    const other = await createDevGameplaySession(server, {
      serverInstanceId: instanceId,
      playerId: "player:lookup-other",
      autoSelectSpawn: false
    });
    const forbidden = await server.gameplaySliceTransport.lookupCommandResult?.({
      sessionToken: other.sessionToken,
      serverInstanceId: instanceId,
      commandId: command.id
    });
    expect(forbidden).toMatchObject({
      accepted: false,
      status: "not_found",
      errors: [{ code: "transport.command_result_not_found" }]
    });
  });

  it("reports not_found without mutating the authoritative runtime", async () => {
    const server = createServerApp();
    const instanceId = "instance:command-result:not-found";
    const session = await createDevGameplaySession(server, {
      serverInstanceId: instanceId,
      playerId: "player:lookup",
      autoSelectSpawn: true
    });
    const before = server.instanceManager.getInstanceById(instanceId)!.state.root.version;

    const lookup = await server.gameplaySliceTransport.lookupCommandResult?.({
      sessionToken: session.sessionToken,
      serverInstanceId: instanceId,
      commandId: "command:missing"
    });

    expect(lookup).toMatchObject({ accepted: false, status: "not_found", errors: [] });
    expect(server.instanceManager.getInstanceById(instanceId)!.state.root.version).toBe(before);
  });
});
