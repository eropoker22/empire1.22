import { describe, expect, it } from "vitest";
import {
  createGameplaySessionTokenCodec,
  validateCommandPlayerIdentity
} from "../../apps/server/src/transport";
import { createFixedClock } from "../../apps/server/src/runtime/scheduling/clock";
import { createPlaceTrapCommandFixture } from "../fixtures/command-fixtures";

describe("player identity transport guard", () => {
  it("allows commands when no auth context is configured for dev flow", () => {
    const command = createPlaceTrapCommandFixture({
      playerId: "player:dev"
    });

    expect(validateCommandPlayerIdentity(command)).toEqual([]);
  });

  it("allows commands when the authenticated player matches command.playerId", () => {
    const command = createPlaceTrapCommandFixture({
      playerId: "player:auth"
    });

    expect(validateCommandPlayerIdentity(command, {
      mode: "authenticated",
      authenticatedPlayerId: "player:auth"
    })).toEqual([]);
  });

  it("rejects commands when the authenticated player does not match command.playerId", () => {
    const command = createPlaceTrapCommandFixture({
      playerId: "player:victim"
    });

    expect(validateCommandPlayerIdentity(command, {
      mode: "authenticated",
      authenticatedPlayerId: "player:attacker"
    })).toEqual([
      {
        code: "PLAYER_IDENTITY_MISMATCH",
        message: "Command playerId does not match the authenticated request identity.",
        details: {
          authenticatedPlayerId: "player:attacker",
          commandPlayerId: "player:victim"
        }
      }
    ]);
  });

  it("allows anonymous identity boundaries until a real session is configured", () => {
    const command = createPlaceTrapCommandFixture({
      playerId: "player:anonymous-dev"
    });

    expect(validateCommandPlayerIdentity(command, {
      mode: "anonymous",
      authenticatedPlayerId: null
    })).toEqual([]);
  });

  it("requires a gameplay session token when a session codec is configured", () => {
    const command = createPlaceTrapCommandFixture({
      playerId: "player:session-required",
      serverInstanceId: "instance:session-required"
    });
    const codec = createGameplaySessionTokenCodec({ secret: "test-session-secret" });

    expect(validateCommandPlayerIdentity(command, null, {
      sessionTokenCodec: codec
    })).toEqual([
      {
        code: "SESSION_REQUIRED",
        message: "Gameplay session token is required for command submit.",
        details: {
          commandPlayerId: "player:session-required",
          commandServerInstanceId: "instance:session-required"
        }
      }
    ]);
  });

  it("allows commands when gameplay session token matches command identity", () => {
    const command = createPlaceTrapCommandFixture({
      playerId: "player:session-owner",
      serverInstanceId: "instance:session-owner"
    });
    const codec = createGameplaySessionTokenCodec({ secret: "test-session-secret" });
    const sessionToken = codec.seal({
      sessionId: "session:owner",
      accountId: "account:owner",
      serverInstanceId: "instance:session-owner",
      playerId: "player:session-owner",
      factionId: "mafian",
      issuedAt: "2026-05-17T00:00:00.000Z",
      expiresAt: "2099-05-18T00:00:00.000Z",
      version: 1
    });

    expect(validateCommandPlayerIdentity(command, null, {
      sessionToken,
      sessionTokenCodec: codec
    })).toEqual([]);
  });

  it("rejects commands when gameplay session token belongs to another player", () => {
    const command = createPlaceTrapCommandFixture({
      playerId: "player:session-victim",
      serverInstanceId: "instance:session-victim"
    });
    const codec = createGameplaySessionTokenCodec({ secret: "test-session-secret" });
    const sessionToken = codec.seal({
      sessionId: "session:attacker",
      accountId: "account:attacker",
      serverInstanceId: "instance:session-victim",
      playerId: "player:session-attacker",
      issuedAt: "2026-05-17T00:00:00.000Z",
      expiresAt: "2099-05-18T00:00:00.000Z",
      version: 1
    });

    expect(validateCommandPlayerIdentity(command, null, {
      sessionToken,
      sessionTokenCodec: codec
    })).toEqual([
      {
        code: "PLAYER_IDENTITY_MISMATCH",
        message: "Command identity does not match the gameplay session token.",
        details: {
          tokenPlayerId: "player:session-attacker",
          tokenServerInstanceId: "instance:session-victim",
          commandPlayerId: "player:session-victim",
          commandServerInstanceId: "instance:session-victim"
        }
      }
    ]);
  });

  it("rejects gameplay session tokens without TTL metadata", () => {
    const command = createPlaceTrapCommandFixture({
      playerId: "player:session-no-ttl",
      serverInstanceId: "instance:session-no-ttl"
    });
    const codec = createGameplaySessionTokenCodec({
      secret: "test-session-secret",
      clock: createFixedClock("2026-05-17T12:00:00.000Z")
    });
    const sessionToken = codec.seal({
      serverInstanceId: "instance:session-no-ttl",
      playerId: "player:session-no-ttl",
      issuedAt: "2026-05-17T00:00:00.000Z"
    } as never);

    expect(validateCommandPlayerIdentity(command, null, {
      sessionToken,
      sessionTokenCodec: codec
    })).toEqual([
      {
        code: "SESSION_INVALID",
        message: "Gameplay session token is invalid."
      }
    ]);
  });

  it("rejects expired gameplay session tokens", () => {
    const command = createPlaceTrapCommandFixture({
      playerId: "player:session-expired",
      serverInstanceId: "instance:session-expired"
    });
    const codec = createGameplaySessionTokenCodec({
      secret: "test-session-secret",
      clock: createFixedClock("2026-05-18T00:00:00.001Z")
    });
    const sessionToken = codec.seal({
      sessionId: "session:expired",
      accountId: "account:expired",
      serverInstanceId: "instance:session-expired",
      playerId: "player:session-expired",
      issuedAt: "2026-05-17T00:00:00.000Z",
      expiresAt: "2026-05-18T00:00:00.000Z",
      version: 1
    });

    expect(validateCommandPlayerIdentity(command, null, {
      sessionToken,
      sessionTokenCodec: codec
    })[0]?.code).toBe("SESSION_INVALID");
  });

  it("rejects gameplay session tokens issued in the future", () => {
    const command = createPlaceTrapCommandFixture({
      playerId: "player:session-future",
      serverInstanceId: "instance:session-future"
    });
    const codec = createGameplaySessionTokenCodec({
      secret: "test-session-secret",
      clock: createFixedClock("2026-05-18T00:00:00.000Z")
    });
    const sessionToken = codec.seal({
      sessionId: "session:future",
      accountId: "account:future",
      serverInstanceId: "instance:session-future",
      playerId: "player:session-future",
      issuedAt: "2026-05-18T00:00:01.000Z",
      expiresAt: "2026-05-19T00:00:00.000Z",
      version: 1
    });

    expect(validateCommandPlayerIdentity(command, null, {
      sessionToken,
      sessionTokenCodec: codec
    })[0]?.code).toBe("SESSION_INVALID");
  });

  it("rejects gameplay session tokens whose expiry is not after issuedAt", () => {
    const command = createPlaceTrapCommandFixture({
      playerId: "player:session-invalid-window",
      serverInstanceId: "instance:session-invalid-window"
    });
    const codec = createGameplaySessionTokenCodec({
      secret: "test-session-secret",
      clock: createFixedClock("2026-05-18T00:00:00.000Z")
    });
    const sessionToken = codec.seal({
      sessionId: "session:invalid-window",
      accountId: "account:invalid-window",
      serverInstanceId: "instance:session-invalid-window",
      playerId: "player:session-invalid-window",
      issuedAt: "2026-05-18T00:00:00.000Z",
      expiresAt: "2026-05-18T00:00:00.000Z",
      version: 1
    });

    expect(validateCommandPlayerIdentity(command, null, {
      sessionToken,
      sessionTokenCodec: codec
    })[0]?.code).toBe("SESSION_INVALID");
  });
});
