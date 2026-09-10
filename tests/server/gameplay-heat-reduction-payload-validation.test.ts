import { describe, expect, it } from "vitest";
import type { DomainError } from "@empire/shared-types";
import { validateGameCommandPayload } from "../../apps/server/src/transport/gameplay-command-payload-validation";
const validate = (payload: unknown) => {
  const errors: DomainError[] = [];
  validateGameCommandPayload(errors, { type: "reduce-police-heat", payload });
  return errors;
};
describe("paid heat reduction accepts intent only", () => {
  it.each(["clean", "dirty", "influence"])("accepts %s", (method) => expect(validate({ method })).toEqual([]));
  it.each(["cost", "heatReduction", "auditRiskPct", "cooldownTicks", "playerId"])("rejects forged %s", (field) => {
    expect(validate({ method: "clean", [field]: 0 })).toContainEqual(expect.objectContaining({ code: "transport.invalid_request" }));
  });
  it.each([{}, null, { method: "free" }, { method: 0 }])("rejects invalid payload %j", (payload) => expect(validate(payload).length).toBeGreaterThan(0));
});
