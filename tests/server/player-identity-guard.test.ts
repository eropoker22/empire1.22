import { describe, expect, it } from "vitest";
import {
  createGameplaySessionTokenCodec,
  validateCommandPlayerIdentity
} from "../../apps/server/src/transport";
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
        code: "transport.player_identity_mismatch",
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
        code: "transport.session_token_missing",
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
      serverInstanceId: "instance:session-owner",
      playerId: "player:session-owner",
      factionId: "mafian",
      issuedAt: new Date(0).toISOString()
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
      serverInstanceId: "instance:session-victim",
      playerId: "player:session-attacker",
      issuedAt: new Date(0).toISOString()
    });

    expect(validateCommandPlayerIdentity(command, null, {
      sessionToken,
      sessionTokenCodec: codec
    })).toEqual([
      {
        code: "transport.session_identity_mismatch",
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
});
