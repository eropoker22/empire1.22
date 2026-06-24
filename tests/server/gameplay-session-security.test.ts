import { describe, expect, it } from "vitest";
import { createInMemoryGameplaySessionService } from "../../apps/server/src/auth";
import { createGameplaySliceFunctionHandler } from "../../apps/server/src/netlify/gameplay-slice-function";
import { createPlaceTrapCommandFixture } from "../fixtures/command-fixtures";

const env = {
  NODE_ENV: "test",
  GAMEPLAY_SLICE_SNAPSHOT_SECRET: "test-snapshot-secret",
  GAMEPLAY_SLICE_SESSION_SECRET: "test-session-secret"
};

const serverInstanceId = "instance:free:eu-central:public-1";

const postEvent = (path: string, body: unknown) => ({
  httpMethod: "POST",
  path,
  body: JSON.stringify(body)
});

const readBody = async (responsePromise: ReturnType<ReturnType<typeof createGameplaySliceFunctionHandler>>) => {
  const response = await responsePromise;
  return {
    ...response,
    json: response.body ? JSON.parse(response.body) : null
  };
};

describe("gameplay session security", () => {
  it("rejects load for a supplied playerId when no gameplay session exists", async () => {
    const handler = createGameplaySliceFunctionHandler({ environment: env });
    const load = await readBody(handler(postEvent("/api/gameplay-slice/load", {
      serverInstanceId,
      playerId: "player:victim",
      districtId: "district:1"
    })));

    expect(load.statusCode).toBe(200);
    expect(load.json.accepted).toBe(false);
    expect(load.json.readModel).toBeNull();
    expect(load.json.errors[0].code).toBe("SESSION_REQUIRED");
    expect(load.json.sessionToken ?? null).toBeNull();
  });

  it("rejects load without playerId when no gameplay session exists", async () => {
    const handler = createGameplaySliceFunctionHandler({ environment: env });
    const load = await readBody(handler(postEvent("/api/gameplay-slice/load", {
      serverInstanceId,
      districtId: "district:1"
    })));

    expect(load.statusCode).toBe(200);
    expect(load.json.accepted).toBe(false);
    expect(load.json.readModel).toBeNull();
    expect(load.json.errors[0].code).toBe("SESSION_REQUIRED");
  });

  it("uses a join ticket once and binds load/submit/logout to the server session", async () => {
    const handler = createGameplaySliceFunctionHandler({ environment: env });
    const reserve = await readBody(handler(postEvent("/api/matchmaking/reserve", {
      accountId: "alice",
      playerId: "player:forged-alice",
      mode: "free",
      preferredServerInstanceId: serverInstanceId
    })));
    const joinTicket = String(reserve.json.reservation.joinTicket);

    const join = await readBody(handler(postEvent("/api/gameplay-slice/join", {
      accountId: "alice",
      playerId: "player:forged-alice",
      joinTicket,
      serverInstanceId,
      preferredStartDistrictId: "district:1",
      factionId: "mafian"
    })));
    const sessionToken = String(join.json.sessionToken);
    const snapshotToken = String(join.json.snapshotToken);
    const serverPlayerId = String(join.json.readModel.player.playerId);

    expect(join.json.accepted).toBe(true);
    expect(serverPlayerId).not.toBe("player:forged-alice");

    const reuse = await readBody(handler(postEvent("/api/gameplay-slice/join", {
      accountId: "alice",
      playerId: "player:forged-alice",
      joinTicket,
      serverInstanceId
    })));
    expect(reuse.json.accepted).toBe(false);
    expect(reuse.json.errors[0].code).toBe("JOIN_TICKET_ALREADY_USED");

    const snapshotOnlyLoad = await readBody(handler(postEvent("/api/gameplay-slice/load", {
      serverInstanceId,
      playerId: serverPlayerId,
      districtId: "district:1",
      snapshotToken
    })));
    expect(snapshotOnlyLoad.json.accepted).toBe(false);
    expect(snapshotOnlyLoad.json.errors[0].code).toBe("SESSION_REQUIRED");

    const forgedCommand = await readBody(handler(postEvent("/api/gameplay-slice/submit", {
      sessionToken,
      snapshotToken,
      focusDistrictId: "district:1",
      command: createPlaceTrapCommandFixture({
        playerId: "player:victim",
        serverInstanceId
      })
    })));
    expect(forgedCommand.json.accepted).toBe(false);
    expect(forgedCommand.json.errors[0].code).toBe("PLAYER_IDENTITY_MISMATCH");

    const snapshotOnlySubmit = await readBody(handler(postEvent("/api/gameplay-slice/submit", {
      snapshotToken,
      focusDistrictId: "district:1",
      command: createPlaceTrapCommandFixture({
        playerId: serverPlayerId,
        serverInstanceId
      })
    })));
    expect(snapshotOnlySubmit.json.accepted).toBe(false);
    expect(snapshotOnlySubmit.json.errors[0].code).toBe("SESSION_REQUIRED");

    const logout = await readBody(handler(postEvent("/api/gameplay-slice/logout", {
      sessionToken
    })));
    expect(logout.json.accepted).toBe(true);

    const revokedLoad = await readBody(handler(postEvent("/api/gameplay-slice/load", {
      serverInstanceId,
      playerId: serverPlayerId,
      sessionToken
    })));
    expect(revokedLoad.json.accepted).toBe(false);
    expect(revokedLoad.json.errors[0].code).toBe("SESSION_REVOKED");
  });

  it("rejects expired tickets and keeps one registration per account/server", () => {
    const service = createInMemoryGameplaySessionService({ ticketTtlMs: 60_000 });
    const first = service.createJoinTicket({
      accountId: "account:concurrent",
      serverInstanceId,
      mode: "free",
      nowIso: "2026-06-24T00:00:00.000Z"
    });
    const second = service.createJoinTicket({
      accountId: "account:concurrent",
      serverInstanceId,
      mode: "free",
      nowIso: "2026-06-24T00:00:00.000Z"
    });
    const expired = service.createJoinTicket({
      accountId: "account:late",
      serverInstanceId,
      mode: "free",
      nowIso: "2026-06-24T00:00:00.000Z"
    });

    const consumedFirst = service.consumeJoinTicket({
      ticketId: first.ticketId,
      accountId: "account:concurrent",
      serverInstanceId,
      nowIso: "2026-06-24T00:00:30.000Z"
    });
    const consumedSecond = service.consumeJoinTicket({
      ticketId: second.ticketId,
      accountId: "account:concurrent",
      serverInstanceId,
      nowIso: "2026-06-24T00:00:31.000Z"
    });
    const consumedExpired = service.consumeJoinTicket({
      ticketId: expired.ticketId,
      accountId: "account:late",
      serverInstanceId,
      nowIso: "2026-06-24T00:02:00.000Z"
    });

    expect(consumedFirst.accepted).toBe(true);
    expect(consumedSecond.accepted).toBe(true);
    if (consumedFirst.accepted && consumedSecond.accepted) {
      expect(consumedSecond.registration.id).toBe(consumedFirst.registration.id);
      expect(consumedSecond.registration.playerId).toBe(consumedFirst.registration.playerId);
    }
    expect(consumedExpired).toMatchObject({
      accepted: false,
      errors: [{ code: "JOIN_TICKET_EXPIRED" }]
    });
    expect(service.listRegistrations()).toHaveLength(1);
  });
});
