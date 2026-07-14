import { describe, expect, it } from "vitest";
import type { DomainError } from "@empire/shared-types";
import { validateGameCommandPayload } from "../../apps/server/src/transport/gameplay-command-payload-validation";

const validatePayload = (payload: Record<string, unknown>) => {
  const errors: DomainError[] = [];
  validateGameCommandPayload(errors, {
    type: "activate-player-boost",
    payload
  });
  return errors;
};

describe("player boost transport validation", () => {
  it("accepts only a canonical boost intent field", () => {
    expect(validatePayload({ boostId: "ghost-network" })).toEqual([]);
  });

  it.each([
    "cleanCashCost",
    "inputCosts",
    "duration",
    "cooldown",
    "expiresAt",
    "effect",
    "combatPowerMultiplier",
    "productionSpeedMultiplier"
  ])("rejects forged authoritative field %s", (field) => {
    expect(validatePayload({ boostId: "ghost-network", [field]: 1 })).toContainEqual(
      expect.objectContaining({
        code: "transport.invalid_request",
        details: { field: `command.payload.${field}` }
      })
    );
  });

  it("rejects a missing or non-string boost id", () => {
    expect(validatePayload({})).toHaveLength(1);
    expect(validatePayload({ boostId: 42 })).toHaveLength(1);
  });
});
