import { describe, expect, it } from "vitest";
import {
  buildDistrictActionViewModel,
  buildDistrictViewModel,
  buildSelectedDistrictSummaryViewModel,
  getDistrictDisplayName,
  getDistrictOwnerLabel,
  getDistrictZoneLabel
} from "../../page-assets/js/app/map/districtViewModel.js";

const districtTypeMeta = {
  resident: { label: "Rezidenční zóna", shortLabel: "Rezidence" },
  downtown: { label: "Downtown", shortLabel: "Centrum" }
};

describe("district view model adapter", () => {
  it("builds view models for owned, foreign, and unclaimed districts", () => {
    const owned = buildDistrictViewModel(
      { id: 1, districtType: "resident" },
      { ownedDistrictIds: new Set([1]), launchOwnerByDistrictId: new Map(), gamePhase: "live" },
      { districtTypeMeta, currentPlayerLabel: "TY" }
    );
    expect(owned.displayName).toBe("District 1");
    expect(owned.zoneLabel).toBe("Rezidence");
    expect(owned.owner.ownerLabel).toBe("TY");

    const foreign = buildDistrictViewModel(
      { id: 2, districtType: "downtown" },
      { ownedDistrictIds: new Set(), launchOwnerByDistrictId: new Map([[2, 4]]), gamePhase: "launch" },
      { districtTypeMeta, getLaunchPlayerName: (id) => `Player ${id}` }
    );
    expect(foreign.zoneLabel).toBe("Centrum");
    expect(foreign.owner.ownerLabel).toBe("Player 4");

    expect(getDistrictOwnerLabel(
      { id: 3, districtType: "resident" },
      { ownedDistrictIds: new Set(), launchOwnerByDistrictId: new Map(), gamePhase: "live" }
    )).toBe("Neobsazeno");
  });

  it("handles partial district data with fallbacks", () => {
    expect(getDistrictDisplayName(null)).toBe("District");
    expect(getDistrictZoneLabel({}, { districtTypeMeta })).toBe("Rezidence");

    const partial = buildDistrictViewModel(null, null, { districtTypeMeta });
    expect(partial.title).toBe("District");
    expect(partial.owner.ownerLabel).toBe("Neobsazeno");
  });

  it("builds selected district summary without mutating state", () => {
    const state = {
      gamePhase: "launch",
      launchOwnerByDistrictId: new Map([[5, 1]]),
      destroyedDistrictIds: new Set()
    };
    const summary = buildSelectedDistrictSummaryViewModel({ id: 5, districtType: "resident" }, state, {
      atmosphereMeta: { shortLabel: "Rezidence" },
      currentPlayerId: 1,
      factionCatalog: { syndicate: { name: "Syndicate" } },
      getLaunchPlayerAvatar: () => "../avatar.png",
      getLaunchPlayerFactionId: () => "syndicate",
      resolveOwnerLabel: () => "TY"
    });

    expect(summary).toMatchObject({
      title: "District 5",
      typeLabel: "Rezidence",
      ownerLabel: "TY",
      ownerMeta: "Syndicate · Tvůj profil",
      ownerAvatarSrc: "../avatar.png"
    });
    expect(state.launchOwnerByDistrictId.get(5)).toBe(1);
  });

  it("builds district action hub model with disabled reasons and trap state", () => {
    const model = buildDistrictActionViewModel({ id: 9 }, {
      activePoliceAction: null,
      resolvedActions: [
        { id: "attack", label: "Útok", enabled: false, reason: "Requires an adjacent owned district." },
        { id: "trap", label: "Past", enabled: true, reason: "", visible: true }
      ],
      actionCountdowns: {
        attack: { label: "Zbývá 0:42", endsAt: 42000 }
      },
      trapControlState: {
        label: "Přesunout past",
        subtitle: "20s",
        title: "Trap move is on cooldown.",
        buttonDisabled: true,
        moveLocked: true
      }
    }, {
      normalizeReason: (reason) => reason === "Requires an adjacent owned district."
        ? "Chybí sousední tvůj district."
        : reason
    });

    expect(model.hidden).toBe(false);
    expect(model.actions[0]).toMatchObject({
      id: "attack",
      enabled: false,
      countdownLabel: "Zbývá 0:42",
      countdownEndsAt: 42000,
      reason: "Chybí sousední tvůj district."
    });
    expect(model.actions[1]).toMatchObject({
      id: "trap",
      enabled: false,
      stacked: true,
      trapState: "cooldown",
      subtitle: "20s"
    });
  });

  it("keeps in-progress disabled district actions visible so their countdown can render", () => {
    const model = buildDistrictActionViewModel({ id: 4 }, {
      activePoliceAction: null,
      resolvedActions: [
        { id: "occupy", label: "Obsadit", enabled: true, reason: "District 4 se právě obsazuje." }
      ],
      actionCountdowns: {
        occupy: { label: "Zbývá 2:10", endsAt: 130000 }
      }
    });

    expect(model.hidden).toBe(false);
    expect(model.headHidden).toBe(true);
    expect(model.actions[0]).toMatchObject({
      id: "occupy",
      enabled: false,
      countdownLabel: "Zbývá 2:10",
      countdownEndsAt: 130000
    });
  });
});
