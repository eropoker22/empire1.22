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

describe("bounty command transport payload validation", () => {
  it("accepts valid bounty objectives and cancel payload", () => {
    expect(validateSubmitGameplayCommandRequest(createSubmitRequest("create-bounty", {
      targetPlayerId: "player:2",
      objectiveType: "attack-player",
      targetDistrictId: null,
      rewardCleanCash: 5_000,
      durationHours: 1,
      isAnonymous: true
    })).accepted).toBe(true);
    expect(validateSubmitGameplayCommandRequest(createSubmitRequest("create-bounty", {
      targetPlayerId: "player:2",
      objectiveType: "attack-district",
      targetDistrictId: "district:2",
      rewardCleanCash: 10_000,
      durationHours: 6
    })).accepted).toBe(true);
    expect(validateSubmitGameplayCommandRequest(createSubmitRequest("create-bounty", {
      targetPlayerId: "player:2",
      objectiveType: "destroy-player-district",
      targetDistrictId: null,
      rewardCleanCash: 25_000,
      durationHours: 24
    })).accepted).toBe(true);
    expect(validateSubmitGameplayCommandRequest(createSubmitRequest("cancel-bounty", {
      bountyId: "bounty:command:create:1"
    })).accepted).toBe(true);
  });

  it("rejects invalid reward, duration and attack-district without target district", () => {
    const belowMinimum = validateSubmitGameplayCommandRequest(createSubmitRequest("create-bounty", {
      targetPlayerId: "player:2",
      objectiveType: "attack-player",
      rewardCleanCash: 4_999,
      durationHours: 1
    }));
    const floatReward = validateSubmitGameplayCommandRequest(createSubmitRequest("create-bounty", {
      targetPlayerId: "player:2",
      objectiveType: "attack-player",
      rewardCleanCash: 5_000.5,
      durationHours: 1
    }));
    const invalidDuration = validateSubmitGameplayCommandRequest(createSubmitRequest("create-bounty", {
      targetPlayerId: "player:2",
      objectiveType: "attack-player",
      rewardCleanCash: 5_000,
      durationHours: 2
    }));
    const missingDistrict = validateSubmitGameplayCommandRequest(createSubmitRequest("create-bounty", {
      targetPlayerId: "player:2",
      objectiveType: "attack-district",
      rewardCleanCash: 5_000,
      durationHours: 1
    }));

    expect(belowMinimum.accepted).toBe(false);
    expect(floatReward.accepted).toBe(false);
    expect(invalidDuration.accepted).toBe(false);
    expect(missingDistrict.accepted).toBe(false);
  });

  it("rejects client supplied bounty authority fields", () => {
    const result = validateSubmitGameplayCommandRequest(createSubmitRequest("create-bounty", {
      targetPlayerId: "player:2",
      objectiveType: "attack-player",
      rewardCleanCash: 5_000,
      durationHours: 1,
      status: "claimed",
      claimedByPlayerId: "player:1",
      payout: 500_000,
      nextState: {}
    }));

    expect(result.accepted).toBe(false);
    expect(result.errors.map((error) => error.details?.field)).toEqual([
      "command.payload.status",
      "command.payload.claimedByPlayerId",
      "command.payload.payout",
      "command.payload.nextState"
    ]);
  });
});
