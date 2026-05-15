import { describe, expect, it } from "vitest";
import { validateCommandPlayerIdentity } from "../../apps/server/src/transport";
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
});
