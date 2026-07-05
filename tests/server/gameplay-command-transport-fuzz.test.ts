import { describe, expect, it } from "vitest";
import { validateSubmitGameplayCommandRequest } from "../../apps/server/src/transport/gameplay-slice-request-validation";

const OMIT_PAYLOAD = Symbol("omit-payload");

const createSubmitRequest = (
  type: string,
  payload: unknown = {},
  overrides: Record<string, unknown> = {}
) => {
  const command: Record<string, unknown> = {
    id: `command:${type}:fuzz`,
    type,
    mode: "free",
    playerId: "player:1",
    serverInstanceId: "instance:free:test",
    issuedAt: new Date(0).toISOString(),
    clientRequestId: null,
    ...overrides
  };

  if (payload !== OMIT_PAYLOAD) {
    command.payload = payload;
  }

  return {
    focusDistrictId: "district:1",
    expectedStateVersion: 1,
    command
  };
};

describe("gameplay command transport fuzzing", () => {
  it.each([
    ["missing payload", OMIT_PAYLOAD, "command.payload"],
    ["null payload", null, "command.payload"],
    ["string payload", "raid:1", "command.payload"],
    ["array payload", ["raid:1"], "command.payload"],
    ["number payload", 1, "command.payload"],
    ["missing raidId", {}, "command.payload.raidId"],
    ["empty raidId", { raidId: "" }, "command.payload.raidId"],
    ["wrong raidId type", { raidId: 42 }, "command.payload.raidId"],
    ["unknown field", { raidId: "police:raid:1", acknowledged: true }, "command.payload.acknowledged"]
  ])("rejects malformed acknowledge-pending-raid payload: %s", (_label, payload, field) => {
    const result = validateSubmitGameplayCommandRequest(createSubmitRequest("acknowledge-pending-raid", payload));

    expect(result.accepted).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({
      code: "transport.invalid_request",
      details: {
        field
      }
    }));
  });

  it("accepts a minimal acknowledge-pending-raid payload before core rule checks", () => {
    const result = validateSubmitGameplayCommandRequest(createSubmitRequest("acknowledge-pending-raid", {
      raidId: "police:raid:1"
    }));

    expect(result.accepted).toBe(true);
  });

  it("rejects deprecated build-structure from the public gameplay slice transport", () => {
    const result = validateSubmitGameplayCommandRequest(createSubmitRequest("build-structure", {
      districtId: "district:1",
      buildingTypeId: "drug_lab",
      slotIndex: 0
    }));

    expect(result.accepted).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({
      code: "transport.invalid_request",
      details: {
        field: "command.type"
      }
    }));
  });

  it.each([
    ["occupy-district", { districtId: "district:2", sourceDistrictId: "district:1", ownerPlayerId: "player:1" }, "command.payload.ownerPlayerId"],
    ["collect-production", { districtId: "district:1", buildingId: "building:1", amount: 999 }, "command.payload.amount"],
    ["craft-item", { districtId: "district:1", buildingId: "building:1", recipeId: "pistol", output: { pistol: 99 } }, "command.payload.output"],
    ["run-building-action", { districtId: "district:1", buildingId: "building:1", actionId: "good_rate", heat: -999 }, "command.payload.heat"]
  ])("rejects unknown authority-shaped payload fields for %s", (type, payload, field) => {
    const result = validateSubmitGameplayCommandRequest(createSubmitRequest(type, payload));

    expect(result.accepted).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({
      code: "transport.invalid_request",
      details: {
        field
      }
    }));
  });
});
