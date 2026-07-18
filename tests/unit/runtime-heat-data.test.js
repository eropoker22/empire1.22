import { describe, expect, it } from "vitest";
import { GANG_HEAT_RAID_PROTECTION_MS } from "../../page-assets/js/app/runtime/heatData.js";

describe("local demo police raid protection", () => {
  it("matches the four-hour real-time cooldown used by the authoritative game", () => {
    expect(GANG_HEAT_RAID_PROTECTION_MS).toBe(4 * 60 * 60 * 1000);
  });
});
