import { describe, expect, it } from "vitest";
import { createAllianceInviteResponseEligibility } from "../../page-assets/js/app/runtime/allianceInviteViewModel.js";

describe("alliance invite response eligibility", () => {
  it("lets the validated target player answer a direct member invite", () => {
    expect(createAllianceInviteResponseEligibility({
      invite: {
        inviteId: "alliance-invite:1",
        targetPlayerId: "player:2",
        kind: "member"
      },
      currentPlayerId: "player:2",
      activeAlliance: null
    })).toEqual({
      canRespond: true,
      disabledReason: null
    });
  });

  it("does not let another player answer the invite", () => {
    expect(createAllianceInviteResponseEligibility({
      invite: {
        inviteId: "alliance-invite:1",
        targetPlayerId: "player:2",
        kind: "member"
      },
      currentPlayerId: "player:3",
      activeAlliance: null
    })).toMatchObject({
      canRespond: false,
      disabledReason: "Pozvánka patří jinému hráči."
    });
  });

  it("keeps alliance contact responses leader-only", () => {
    const invite = {
      inviteId: "alliance-contact-invite:1",
      targetPlayerId: "player:2",
      kind: "alliance_contact"
    };

    expect(createAllianceInviteResponseEligibility({
      invite,
      currentPlayerId: "player:2",
      activeAlliance: { currentPlayerRole: "member" }
    }).canRespond).toBe(false);
    expect(createAllianceInviteResponseEligibility({
      invite,
      currentPlayerId: "player:2",
      activeAlliance: { currentPlayerRole: "leader" }
    }).canRespond).toBe(true);
  });
});
