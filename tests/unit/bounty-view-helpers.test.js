import { describe, expect, it } from "vitest";
import {
  getBountyDisplayLabel,
  getBountyDisplayType,
  getBountyDistrictLabel,
  getBountyIconType,
  getBountyRemainingMs,
  withBountyCountdownSnapshot
} from "../../page-assets/js/app/bounty-view-helpers.js";

describe("bounty view helpers", () => {
  it("normalizes selected destroy district bounties from server data", () => {
    const bounty = {
      objectiveType: "destroy-player-district",
      targetDistrictId: "district:12",
      targetDistrictName: "District 12"
    };

    expect(getBountyDisplayType(bounty)).toBe("destroy-selected-district");
    expect(getBountyIconType(bounty)).toBe("destroy-selected-district");
    expect(getBountyDisplayLabel(bounty)).toBe("Zničit vybraný district");
    expect(getBountyDistrictLabel(bounty)).toBe("District 12");
  });

  it("keeps any-district destroy bounties without a district label", () => {
    const bounty = {
      objectiveType: "destroy-player-district",
      targetDistrictId: null
    };

    expect(getBountyDisplayType(bounty)).toBe("destroy-player-district");
    expect(getBountyDisplayLabel(bounty)).toBe("Zničit jakýkoli district");
    expect(getBountyDistrictLabel(bounty)).toBe("—");
  });

  it("decreases remainingMs from the received snapshot", () => {
    const bounty = withBountyCountdownSnapshot({ remainingMs: 10_000 }, 1_000);

    expect(getBountyRemainingMs(bounty, 4_500)).toBe(6_500);
  });

  it("never returns negative countdown time", () => {
    const bounty = withBountyCountdownSnapshot({ remainingMs: 2_000 }, 1_000);

    expect(getBountyRemainingMs(bounty, 10_000)).toBe(0);
  });
});
