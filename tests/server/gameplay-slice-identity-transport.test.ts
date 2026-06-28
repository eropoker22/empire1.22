import { describe, expect, it } from "vitest";
import { createServerApp } from "../../apps/server/src/app";
import { createGameplaySliceTransport } from "../../apps/server/src/transport";
import { createPlaceTrapCommandFixture } from "../fixtures/command-fixtures";
import { createDevGameplaySession } from "../helpers/gameplay-session-test-helpers";

describe("gameplay slice transport identity boundary", () => {
  it("rejects submit before command ingress when auth context does not match command.playerId", async () => {
    let ingressCalls = 0;
    const server = createServerApp();
    const session = await createDevGameplaySession(server, {
      serverInstanceId: "instance:transport-identity",
      playerId: "player:victim",
      autoSelectSpawn: true
    });
    const transport = createGameplaySliceTransport(
      server.instanceManager,
      {
        submit: async () => {
          ingressCalls += 1;
          return undefined;
        }
      },
      {
        sessionTokenCodec: server.gameplaySessionTokenCodec,
        gameplaySessionService: server.gameplaySessionService
      }
    );

    const response = await transport.submit(
      {
        sessionToken: session.sessionToken,
        focusDistrictId: "district:2",
        command: createPlaceTrapCommandFixture({
          playerId: "player:victim",
          serverInstanceId: "instance:transport-identity"
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
          code: "PLAYER_IDENTITY_MISMATCH"
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
          code: "SESSION_INVALID"
        }
      ]
    });

    const diagnostics = await server.instanceManager.listDiagnosticRecords(runtime.record.id);
    expect(diagnostics.at(-1)).toMatchObject({
      level: "warn",
      category: "transport_rejected",
      message: "Command rejected by transport session guard.",
      context: {
        commandId: command.id,
        commandType: "place-trap",
        playerId: command.playerId,
        serverInstanceId: runtime.record.id,
        currentTick: runtime.state.root.tick,
        rootVersion: runtime.state.root.version,
        errorCodes: ["SESSION_INVALID"],
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
