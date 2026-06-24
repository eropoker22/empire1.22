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

describe("basic action transport payload validation", () => {
  it("accepts valid rob, heist and defense payloads", () => {
    expect(validateSubmitGameplayCommandRequest(createSubmitRequest("rob-district", {
      targetDistrictId: "district:2",
      sourceDistrictId: "district:1",
      expectedTargetVersion: 1,
      expectedSourceVersion: 1
    })).accepted).toBe(true);
    expect(validateSubmitGameplayCommandRequest(createSubmitRequest("heist-district", {
      targetDistrictId: "district:2",
      sourceDistrictId: "district:1",
      style: "balanced",
      gangMembersSent: 10
    })).accepted).toBe(true);
    expect(validateSubmitGameplayCommandRequest(createSubmitRequest("place-defense", {
      targetDistrictId: "district:1",
      defenseItemId: "barricades",
      amount: 1
    })).accepted).toBe(true);
    expect(validateSubmitGameplayCommandRequest(createSubmitRequest("remove-defense", {
      targetDistrictId: "district:1",
      defenseItemId: "barricades",
      amount: 1
    })).accepted).toBe(true);
  });

  it("rejects client-forced outcomes, loot and owner fields", () => {
    const request = createSubmitRequest("heist-district", {
      targetDistrictId: "district:2",
      sourceDistrictId: "district:1",
      style: "balanced",
      gangMembersSent: 10,
      outcome: "success",
      loot: { cash: 9999 },
      targetOwnerPlayerId: "player:2",
      roll: 0.99
    });

    const result = validateSubmitGameplayCommandRequest(request);

    expect(result.accepted).toBe(false);
    expect(result.errors.map((error) => error.details?.field)).toEqual([
      "command.payload.outcome",
      "command.payload.loot",
      "command.payload.targetOwnerPlayerId",
      "command.payload.roll"
    ]);
  });

  it("rejects invalid heist style and defense amount", () => {
    const heist = validateSubmitGameplayCommandRequest(createSubmitRequest("heist-district", {
      targetDistrictId: "district:2",
      style: "loud",
      gangMembersSent: 10
    }));
    const defense = validateSubmitGameplayCommandRequest(createSubmitRequest("place-defense", {
      targetDistrictId: "district:1",
      defenseItemId: "barricades",
      amount: 0
    }));

    expect(heist.accepted).toBe(false);
    expect(defense.accepted).toBe(false);
  });
});
