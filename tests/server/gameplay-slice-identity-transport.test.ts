import { describe, expect, it } from "vitest";
import { createServerApp } from "../../apps/server/src/app";
import { ServerInstanceManager } from "../../apps/server/src/runtime";
import { createGameplaySliceTransport } from "../../apps/server/src/transport";
import { createPlaceTrapCommandFixture } from "../fixtures/command-fixtures";

describe("gameplay slice transport identity boundary", () => {
  it("rejects submit before command ingress when auth context does not match command.playerId", async () => {
    let ingressCalls = 0;
    const transport = createGameplaySliceTransport(
      new ServerInstanceManager(),
      {
        submit: async () => {
          ingressCalls += 1;
          return undefined;
        }
      }
    );

    const response = await transport.submit(
      {
        focusDistrictId: "district:2",
        command: createPlaceTrapCommandFixture({
          playerId: "player:victim"
        })
      },
      {
        mode: "authenticated",
        authenticatedPlayerId: "player:attacker"
      }
    );

    expect(response).toMatchObject({
      accepted: false,
      readModel: null,
      errors: [
        {
          code: "transport.player_identity_mismatch"
        }
      ]
    });
    expect(ingressCalls).toBe(0);
  });

  it("writes safe diagnostics for transport session rejection without leaking tokens", async () => {
    const server = createServerApp({
      gameplaySessionTokenSecret: "test-gameplay-session-secret"
    });
    const runtime = server.instanceManager.createInstance("instance:transport-rejected", "free");
    const command = createPlaceTrapCommandFixture({
      id: "command:transport:invalid-session",
      playerId: "player:transport-rejected",
      serverInstanceId: runtime.record.id,
      clientRequestId: "client-request:transport-rejected"
    });

    const response = await server.gameplaySliceTransport.submit({
      focusDistrictId: "district:2",
      expectedStateVersion: runtime.state.root.version,
      sessionToken: "unsafe-session-token",
      snapshotToken: "unsafe-snapshot-token",
      command
    });

    expect(response).toMatchObject({
      accepted: false,
      readModel: null,
      errors: [
        {
          code: "transport.session_token_invalid"
        }
      ]
    });

    const diagnostics = await server.instanceManager.listDiagnosticRecords(runtime.record.id);
    expect(diagnostics.at(-1)).toMatchObject({
      level: "warn",
      category: "transport_rejected",
      message: "Command rejected by transport identity guard.",
      context: {
        commandId: command.id,
        commandType: "place-trap",
        playerId: command.playerId,
        serverInstanceId: runtime.record.id,
        currentTick: runtime.state.root.tick,
        rootVersion: runtime.state.root.version,
        errorCodes: ["transport.session_token_invalid"],
        expectedStateVersion: runtime.state.root.version,
        currentStateVersion: runtime.state.root.version,
        focusDistrictId: "district:2",
        clientRequestId: "client-request:transport-rejected"
      }
    });

    const serializedContext = JSON.stringify(diagnostics.at(-1)?.context);
    expect(serializedContext).not.toContain("unsafe-session-token");
    expect(serializedContext).not.toContain("unsafe-snapshot-token");
  });
});
