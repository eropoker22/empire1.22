import { describe, expect, it } from "vitest";
import { createAlliancePenaltyNewsModels } from "../../page-assets/js/app/runtime/alliancePenaltyPresentation.js";
const at = hour => `2026-09-10T${String(hour).padStart(2, "0")}:00:00.000Z`;
const penalty = { id: "p", startedAt: at(8), penaltyEndsAt: at(20), statDebuffEndsAt: at(20), influenceDebuffEndsAt: at(16), actionCooldownDebuffEndsAt: at(14), attackMultiplier: .8, defenseMultiplier: .8, influenceGenerationMultiplier: .8, actionCooldownMultiplier: 1.15 };
describe("alliance penalty countdown presentation", () => {
  it("shows each actual deadline and removes only expired effects", () => {
    const before = createAlliancePenaltyNewsModels({ exitPenalties: [penalty] }, Date.parse(at(13)), String);
    expect(before.map(m => m.expiresAt).sort()).toEqual([at(14), at(16), at(20)].map(Date.parse).sort());
    const after = createAlliancePenaltyNewsModels({ exitPenalties: [penalty] }, Date.parse(at(17)), String);
    expect(after.map(m => m.title)).toEqual(["Bojová síla"]);
    expect(after[0].resultPayload.rows.at(-1).countdownUntil).toBe(Date.parse(at(20)));
    expect(createAlliancePenaltyNewsModels({ exitPenalties: [penalty] }, Date.parse(at(20)), String)).toEqual([]);
  });
  it("preserves a second active effect when the newest penalty expires", () => {
    expect(createAlliancePenaltyNewsModels({ exitPenalties: [{ ...penalty, id: "second" }, { ...penalty, statDebuffEndsAt: at(14) }] }, Date.parse(at(17)), String)).toHaveLength(1);
  });
});
