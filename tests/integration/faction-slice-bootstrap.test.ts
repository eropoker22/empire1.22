import { describe, expect, it } from "vitest";
import { createClientApp } from "../../apps/client/src/app";
import { createServerApp } from "../../apps/server/src/app";
import {
  ensureGameplaySliceSession,
  ensureGameplaySliceSessionResult
} from "../../apps/server/src/bootstrap/gameplay-slice-session-bootstrap";
import { createInMemoryClientTransport } from "../../apps/client/src/transport";
import { createGameplaySessionTokenCodec } from "../../apps/server/src/transport";
import { createPlaceTrapCommandFixture } from "../fixtures/command-fixtures";

describe("faction gameplay slice bootstrap", () => {
  it("persists requested faction without local starting package authority", async () => {
    const server = createServerApp();
    const client = createClientApp({
      transport: createInMemoryClientTransport(server.gameplaySliceTransport)
    });

    const request = {
      serverInstanceId: "instance:free-faction-foundation",
      playerId: "player:faction-test",
      districtId: "district:77",
      factionId: "kartel"
    };

    await ensureGameplaySliceSession(server.instanceManager, request);
    await client.load(request);

    const runtime = server.instanceManager.getInstanceById("instance:free-faction-foundation");
    const player = runtime?.state.playersById["player:faction-test"];
    const resources = player ? runtime?.state.resourceStatesById[player.resourceStateId] : null;

    expect(player?.factionId).toBe("kartel");
    expect(resources?.balances).toMatchObject({
      cash: 1500,
      "dirty-cash": 300,
      chemicals: 10
    });
    expect(client.getGameplaySlice()?.player.faction).toMatchObject({
      factionId: "kartel",
      activePassiveEffects: expect.arrayContaining(["+18 % dirty income"])
    });
  });

  it("normalizes an invalid requested faction to the mode default on the server", async () => {
    const server = createServerApp();
    const request = {
      serverInstanceId: "instance:free-invalid-faction",
      playerId: "player:invalid-faction",
      districtId: "district:78",
      factionId: "not-a-real-faction"
    };

    const result = await ensureGameplaySliceSessionResult(server.instanceManager, request);
    const response = server.gameplaySliceTransport.load(request);
    const runtime = server.instanceManager.getInstanceById(request.serverInstanceId);

    expect(result).toMatchObject({
      accepted: true,
      joinedPlayer: true,
      errors: []
    });
    expect(runtime?.state.playersById[request.playerId]?.factionId).toBe("mafian");
    expect(response.readModel?.player.factionId).toBe("mafian");
    expect(response.readModel?.player.faction).toMatchObject({
      factionId: "mafian"
    });
  });

  it("keeps repeated joins idempotent and does not change an existing player faction", async () => {
    const server = createServerApp();
    const firstRequest = {
      serverInstanceId: "instance:free-faction-rejoin",
      playerId: "player:faction-rejoin",
      districtId: "district:79",
      factionId: "kartel"
    };
    const secondRequest = {
      ...firstRequest,
      factionId: "hackeri"
    };

    const first = await ensureGameplaySliceSessionResult(server.instanceManager, firstRequest);
    const second = await ensureGameplaySliceSessionResult(server.instanceManager, secondRequest);
    const response = server.gameplaySliceTransport.load(secondRequest);
    const runtime = server.instanceManager.getInstanceById(firstRequest.serverInstanceId);

    expect(first.joinedPlayer).toBe(true);
    expect(second).toMatchObject({
      accepted: true,
      createdInstance: false,
      joinedPlayer: false,
      errors: []
    });
    expect(runtime?.state.root.playerIds).toEqual([firstRequest.playerId]);
    expect(runtime?.state.playersById[firstRequest.playerId]?.factionId).toBe("kartel");
    expect(response.readModel?.player.factionId).toBe("kartel");
  });

  it("issues a session token bound to the server-normalized player faction", async () => {
    const secret = "test-faction-session-secret";
    const server = createServerApp({
      gameplaySessionTokenSecret: secret
    });
    const codec = createGameplaySessionTokenCodec({ secret });
    const request = {
      serverInstanceId: "instance:free-faction-token",
      playerId: "player:faction-token",
      districtId: "district:80",
      factionId: "cartel"
    };

    await ensureGameplaySliceSessionResult(server.instanceManager, request);
    const load = server.gameplaySliceTransport.load(request);
    const payload = codec.open(load.sessionToken ?? "");

    expect(load.readModel?.player.factionId).toBe("kartel");
    expect(payload).toMatchObject({
      serverInstanceId: request.serverInstanceId,
      playerId: request.playerId,
      factionId: "kartel"
    });

    const submit = server.gameplaySliceTransport.submit({
      sessionToken: load.sessionToken,
      focusDistrictId: load.readModel?.district?.districtId ?? "district:server-assigned",
      command: createPlaceTrapCommandFixture({
        id: "command:faction-token:trap",
        mode: "free",
        playerId: request.playerId,
        serverInstanceId: request.serverInstanceId,
        payload: {
          districtId: load.readModel?.player.homeDistrictId ?? "district:spawn:1"
        }
      })
    });

    expect(submit.errors.map((error) => error.code)).not.toContain("transport.session_identity_mismatch");
    expect(submit.errors.map((error) => error.code)).not.toContain("transport.session_token_invalid");
    expect(submit.readModel?.player.factionId).toBe("kartel");
  });

  it("does not create a fallback mafian session for cold submit without snapshot", async () => {
    const server = createServerApp();
    const request = {
      focusDistrictId: "district:88",
      command: {
        id: "command:faction-submit-without-runtime",
        type: "collect-production",
        mode: "free",
        playerId: "player:kartel-cold-submit",
        serverInstanceId: "instance:free-faction-cold-submit",
        issuedAt: new Date(0).toISOString(),
        payload: {
          districtId: "district:88",
          buildingId: "building:district:88:factory:1"
        },
        clientRequestId: null
      }
    } as const;

    await expect(ensureGameplaySliceSession(server.instanceManager, request)).resolves.toBe(false);
    expect(server.instanceManager.getInstanceById("instance:free-faction-cold-submit")).toBeUndefined();

    const response = server.gameplaySliceTransport.submit(request);

    expect(response.accepted).toBe(false);
    expect(response.errors[0]?.code).toBe("transport.session_token_missing");
  });
});
