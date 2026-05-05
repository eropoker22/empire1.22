import { describe, expect, it } from "vitest";
import {
  buildDistrictIntelEventText,
  createDistrictGossipRuntime,
  formatDistrictReference,
  normalizeDistrictGossipKey,
  resolveDistrictNumericId
} from "../../page-assets/js/app/runtime/districtGossipRuntime.js";

describe("district gossip runtime", () => {
  it("normalizes district references safely", () => {
    expect(normalizeDistrictGossipKey({ id: "District 17" })).toBe("district-17");
    expect(resolveDistrictNumericId("district:42")).toBe(42);
    expect(formatDistrictReference(null)).toBe("Neznámý district");
  });

  it("keeps gossip disabled outside dev/demo mode", () => {
    const runtime = createDistrictGossipRuntime({
      isDevMode: () => false,
      getWorldState: () => ({ districtGossipById: { "1": [{ text: "Hidden", createdAt: 1 }] } })
    });

    expect(runtime.getDistrictGossipEntries(1)).toEqual([]);
    expect(runtime.appendDistrictGossip(1, "Text")).toBeNull();
  });

  it("appends and limits district gossip without mutating gameplay data", () => {
    let worldState = { districtGossipById: {} };
    const runtime = createDistrictGossipRuntime({
      isDevMode: () => true,
      getWorldState: () => worldState,
      setWorldState: (nextState) => {
        worldState = nextState;
      },
      maxPerDistrict: 1
    });

    runtime.appendDistrictGossip(7, "První drb", { createdAt: 1 });
    runtime.appendDistrictGossip(7, "Nový drb", { createdAt: 2 });

    const entries = runtime.getDistrictGossipEntries(7);
    expect(entries).toHaveLength(1);
    expect(entries[0].text).toBe("Nový drb");
  });

  it("builds district intel event text with stable fallbacks", () => {
    expect(buildDistrictIntelEventText("raid_success", 3, { lootLabel: "Tech Core x1" }))
      .toContain("Tech Core x1");
    expect(buildDistrictIntelEventText("unknown", 3)).toContain("District 3");
  });
});
