import { describe, expect, it } from "vitest";
import { validateSubmitGameplayCommandRequest } from "../../apps/server/src/transport/gameplay-slice-request-validation";

const createSubmitRequest = (type: string, payload: Record<string, unknown>) => ({
  focusDistrictId: "district:1",
  expectedStateVersion: 1,
  command: {
    id: `command:${type}:1`,
    type,
    mode: "free",
    playerId: "player:1",
    serverInstanceId: "instance:1",
    issuedAt: new Date(0).toISOString(),
    payload,
    clientRequestId: null
  }
});

describe("alliance command transport payload validation", () => {
  it("accepts server-authoritative alliance MVP commands", () => {
    expect(validateSubmitGameplayCommandRequest(createSubmitRequest("create-alliance", {
      name: "Neon Pact",
      tag: "NP",
      emblemColor: "#ff2f5f"
    })).accepted).toBe(true);
    expect(validateSubmitGameplayCommandRequest(createSubmitRequest("join-alliance", {
      allianceId: "alliance:1"
    })).accepted).toBe(true);
    expect(validateSubmitGameplayCommandRequest(createSubmitRequest("invite-alliance-member", {
      allianceId: "alliance:1",
      targetPlayerId: "player:2"
    })).accepted).toBe(true);
    expect(validateSubmitGameplayCommandRequest(createSubmitRequest("respond-alliance-invite", {
      inviteId: "alliance-invite:1",
      response: "accept"
    })).accepted).toBe(true);
    expect(validateSubmitGameplayCommandRequest(createSubmitRequest("send-alliance-chat-message", {
      allianceId: "alliance:1",
      body: "Ready."
    })).accepted).toBe(true);
    expect(validateSubmitGameplayCommandRequest(createSubmitRequest("send-public-alliance-message", {
      allianceId: "alliance:2",
      body: "Jednáme."
    })).accepted).toBe(true);
    expect(validateSubmitGameplayCommandRequest(createSubmitRequest("send-public-alliance-invite", {
      allianceId: "alliance:2"
    })).accepted).toBe(true);
  });

  it("rejects client supplied alliance authority fields", () => {
    const result = validateSubmitGameplayCommandRequest(createSubmitRequest("create-alliance", {
      name: "Fake",
      status: "active",
      ownerPlayerId: "player:2",
      memberIds: ["player:2"],
      createdAt: new Date().toISOString()
    }));

    expect(result.accepted).toBe(false);
    expect(result.errors.map((error) => error.details?.field)).toEqual([
      "command.payload.status",
      "command.payload.ownerPlayerId",
      "command.payload.memberIds",
      "command.payload.createdAt"
    ]);
  });

  it("rejects forged chat author and invalid invite response", () => {
    expect(validateSubmitGameplayCommandRequest(createSubmitRequest("send-alliance-chat-message", {
      allianceId: "alliance:1",
      body: "Fake",
      authorPlayerId: "player:2",
      createdAt: new Date().toISOString()
    })).accepted).toBe(false);
    expect(validateSubmitGameplayCommandRequest(createSubmitRequest("respond-alliance-invite", {
      inviteId: "alliance-invite:1",
      response: "claim"
    })).accepted).toBe(false);
  });
});
