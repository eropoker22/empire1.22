import { describe, expect, it } from "vitest";
import { createServerApp } from "../../apps/server/src/app";
import { ensureDefaultLobbyServers } from "../../apps/server/src/netlify/gameplay-slice-function-default-servers";
import { createFixedClock } from "../../apps/server/src/runtime/scheduling/clock";

describe("public server matchmaking", () => {
  it("reserves the lowest-latency public server for the requested mode", () => {
    const server = createServerApp({
      clock: createFixedClock("2026-05-21T06:00:00.000Z")
    });
    ensureDefaultLobbyServers(server);

    const response = server.publicServerMatchmaking.reservePublicServer({
      playerId: "player:mm:1",
      mode: "free",
      regionLatencyMs: {
        "EU Central": 15
      }
    });

    expect(response).toMatchObject({
      accepted: true,
      reservation: {
        serverInstanceId: "instance:free:eu-central:public-1",
        mode: "free",
        region: "EU Central",
        expiresAt: "2026-05-21T06:01:00.000Z"
      },
      errors: []
    });
  });

  it("migrates legacy war aliases and rejects the closed server", () => {
    const server = createServerApp({
      clock: createFixedClock("2026-05-21T06:00:00.000Z")
    });
    ensureDefaultLobbyServers(server);

    const response = server.publicServerMatchmaking.reservePublicServer({
      playerId: "player:mm:legacy",
      preferredServerInstanceId: "war-eu-01"
    });

    expect(response).toMatchObject({
      accepted: false,
      reservation: null,
      errors: [expect.objectContaining({ code: "matchmaking.server_closed" })]
    });
  });

  it("rejects closed war mode before creating a reservation", () => {
    const server = createServerApp();
    ensureDefaultLobbyServers(server);

    expect(server.publicServerMatchmaking.reservePublicServer({
      playerId: "player:mm:war",
      mode: "war"
    })).toMatchObject({
      accepted: false,
      reservation: null,
      errors: [expect.objectContaining({
        code: "matchmaking.server_closed",
        message: "War server je dočasně uzavřený. Teď testujeme Free režim."
      })]
    });

    expect(server.publicServerMatchmaking.listActiveReservations()).toEqual([]);
  });

  it("rejects full or stopped public servers", () => {
    const server = createServerApp();
    ensureDefaultLobbyServers(server);
    server.instanceManager.stopInstance("instance:free:eu-central:public-1");
    const freeTwo = server.instanceManager.getInstanceById("instance:free:eu-central:public-2")!;
    freeTwo.lobby.maxPlayers = 1;
    freeTwo.state.root.playerIds = ["player:existing"];
    freeTwo.state.playersById["player:existing"] = {} as never;

    expect(server.publicServerMatchmaking.reservePublicServer({
      playerId: "player:mm:free",
      mode: "free"
    })).toMatchObject({
      accepted: false,
      reservation: null,
      errors: [expect.objectContaining({ code: "matchmaking.no_public_server" })]
    });
  });
});
