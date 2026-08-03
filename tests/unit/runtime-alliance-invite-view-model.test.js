import { describe, expect, it } from "vitest";
import {
  createAllianceInviteResponseEligibility,
  resolveAllianceInviteDraftTargetPlayerId
} from "../../page-assets/js/app/runtime/allianceInviteViewModel.js";

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

describe("alliance invite draft target", () => {
  const draft = { allianceId: "alliance:1", targetPlayerId: "player:2" };
  const inviteTargets = [
    { playerId: "player:2", canInvite: true },
    { playerId: "player:3", canInvite: false }
  ];

  it("preserves an eligible target across an authoritative rerender", () => {
    expect(resolveAllianceInviteDraftTargetPlayerId({
      draft,
      allianceId: "alliance:1",
      canInvite: true,
      inviteTargets
    })).toBe("player:2");
  });

  it.each([
    ["another alliance", { allianceId: "alliance:other", canInvite: true, inviteTargets }],
    ["lost permission", { allianceId: "alliance:1", canInvite: false, inviteTargets }],
    ["missing target", { allianceId: "alliance:1", canInvite: true, inviteTargets: [] }],
    ["disabled target", {
      allianceId: "alliance:1",
      canInvite: true,
      inviteTargets: [{ playerId: "player:2", canInvite: false }]
    }]
  ])("clears the draft for %s", (_caseName, input) => {
    expect(resolveAllianceInviteDraftTargetPlayerId({ draft, ...input })).toBe("");
  });
});
