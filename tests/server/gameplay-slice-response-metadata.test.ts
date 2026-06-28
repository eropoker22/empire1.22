import { describe, expect, it } from "vitest";
import { createServerApp } from "../../apps/server/src/app";
import { createPlaceTrapCommandFixture } from "../fixtures/command-fixtures";
import { createDevGameplaySession, loadWithDevGameplaySession } from "../helpers/gameplay-session-test-helpers";

describe("gameplay slice response metadata", () => {
  it("load response carries the current server tick and state version", async () => {
    const server = createServerApp();
    const instanceId = "instance:metadata:load";

    const session = await createDevGameplaySession(server, {
      serverInstanceId: instanceId,
      playerId: "player:metadata:load",
      districtId: "district:501"
    });

    const runtime = server.instanceManager.getInstanceById(instanceId);

    if (!runtime) {
      throw new Error("Metadata load fixture failed to create a runtime.");
    }

    runtime.state.root.tick = 17;
    runtime.state.root.version = 23;

    const response = await server.gameplaySliceTransport.load(session.loadRequest);

    expect(response.accepted).toBe(true);
    expect(response.metadata).toEqual({
      serverTick: 17,
      stateVersion: 23
    });
  });

  it("submit response carries metadata from the runtime after command dispatch", async () => {
    const server = createServerApp();
    const instanceId = "instance:metadata:submit";

    const { sessionToken } = await loadWithDevGameplaySession(server, {
      serverInstanceId: instanceId,
      playerId: "player:metadata:submit",
      districtId: "district:601"
    });

    const runtime = server.instanceManager.getInstanceById(instanceId);

    if (!runtime) {
      throw new Error("Metadata submit fixture failed to create a runtime.");
    }

    runtime.state.root.tick = 31;
    runtime.state.root.version = 41;
    const response = await server.gameplaySliceTransport.submit({
      sessionToken,
      focusDistrictId: "district:601",
      command: createPlaceTrapCommandFixture({
        id: "command:metadata:submit:1",
        playerId: "player:metadata:submit",
        serverInstanceId: instanceId,
        payload: {
          districtId: "district:601"
        }
      })
    });

    expect(response.metadata).toEqual({
      serverTick: runtime.state.root.tick,
      stateVersion: runtime.state.root.version
    });
  });
});
