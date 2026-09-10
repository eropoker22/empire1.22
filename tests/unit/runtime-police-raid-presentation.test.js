import { describe, expect, it } from "vitest";
import { createServerPoliceRaidNews } from "../../page-assets/js/app/runtime/policeRaidPresentation.js";

describe("authoritative police street news", () => {
  it("explains a routine inspection consistently while active and after reload", () => {
    const now = Date.now();
    const explanation = "Pravidelná namátková kontrola města. Bez zabavení zásob, peněz a bez uzavření budov.";
    const raid = { raidId: "inspection:1", kind: "inspection", explanation, status: "pending",
      consequencesAppliedAtTick: 10, expiresAtMs: now + 60_000, previewConsequences: { seizedDirtyCash: 0, seizedResources: {} } };
    const event = { type: "police-raid-resolved", createdAtTick: 10,
      payload: { raidId: raid.raidId, kind: raid.kind, explanation, ...raid.previewConsequences } };
    const active = createServerPoliceRaidNews({ pendingRaid: raid, policeFeed: [event] }, { now });
    const restored = createServerPoliceRaidNews({ policeFeed: [event] }, { now });
    expect(active).toHaveLength(1);
    expect(active[0].title).toBe("RUTINNÍ POLICEJNÍ KONTROLA");
    expect(restored[0].title).toBe("VÝSLEDEK POLICEJNÍ KONTROLY");
    expect(active[0].summary).toBe(explanation);
    expect(restored[0].summary).toBe(explanation);
    expect(active[0].resultPayload.getRows()).toContainEqual({ label: "Provoz budov", value: "Bez omezení" });
  });

  it("restores active and completed raids from server data without duplicating their consequence event", () => {
    const now = Date.now();
    const raid = { raidId: "raid:1", status: "pending", consequencesAppliedAtTick: 10, createdAtTick: 10,
      expiresAtMs: now + 60_000, targetDistrictId: "district:2", previewConsequences: { seizedDirtyCash: 220, seizedResources: { chemicals: 5 } } };
    const event = { type: "police-raid-resolved", createdAtTick: 10, districtId: "district:2", payload: { raidId: raid.raidId, ...raid.previewConsequences } };
    const active = createServerPoliceRaidNews({ pendingRaid: raid, policeFeed: [event] }, { now, tick: 10 });
    expect(active).toHaveLength(1);
    expect(active[0].title).toBe("PROBÍHÁ POLICEJNÍ RAZIE");
    expect(active[0].resultPayload.getRows()).toContainEqual({ label: "Zabavené špinavé peníze", value: 220 });
    expect(active[0].resultPayload.getRows()).toContainEqual({ label: "Chemikálie", value: "−5" });
    const restored = createServerPoliceRaidNews({ pendingRaid: null, policeFeed: [event] }, { now });
    expect(restored).toHaveLength(1);
    expect(restored[0].id).toBe(active[0].id);
    expect(restored[0].title).toBe("DOPADY POLICEJNÍ RAZIE");
    expect(restored[0].resultPayload.getRows()).toContainEqual({ label: "Zabavené špinavé peníze", value: 220 });
  });
});
