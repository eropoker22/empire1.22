import { describe, expect, it } from "vitest";
import type { DomainError } from "@empire/shared-types";
import { validateGameCommandPayload } from "../../apps/server/src/transport/gameplay-command-payload-validation";

const validatePayload = (payload: Record<string, unknown>) => {
  const errors: DomainError[] = [];
  validateGameCommandPayload(errors, {
    type: "attack-district",
    payload
  });
  return errors;
};

describe("attack weapon transport validation", () => {
  it("accepts a safe weapon quantity intent", () => {
    expect(validatePayload({
      districtId: "district:2",
      sourceDistrictId: "district:1",
      weapons: { pistol: 2, smg: 1 }
    })).toEqual([]);
  });

  it("rejects forged authority and invalid weapon values before command dispatch", () => {
    expect(validatePayload({
      districtId: "district:2",
      sourceDistrictId: "district:1",
      weapons: { pistol: 1.5, railgun: 1 },
      totalAttackPower: 999,
      populationRequired: 0
    })).toHaveLength(4);
  });
});
