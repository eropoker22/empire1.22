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

  it("hides selected district type until ownership or spy intel reveals it", () => {
    const hidden = buildSelectedDistrictSummaryViewModel({ id: 7, districtType: "park" }, {
      gamePhase: "live",
      ownedDistrictIds: new Set(),
      launchOwnerByDistrictId: new Map(),
      destroyedDistrictIds: new Set()
    }, {
      atmosphereMeta: { shortLabel: "Parkový sektor" },
      spyIntel: { revealedTypeDistrictIds: [] }
    });
    expect(hidden.typeLabel).toBe("Neznámý sektor");
    expect(hidden.ownerAvatarHidden).toBe(true);
    expect(hidden.ownerAvatarSrc).toBe("");
    expect(hidden.ownerFallback).toBe("");

    const revealed = buildSelectedDistrictSummaryViewModel({ id: 7, districtType: "park" }, {
      gamePhase: "live",
      ownedDistrictIds: new Set(),
      launchOwnerByDistrictId: new Map(),
      destroyedDistrictIds: new Set()
    }, {
      atmosphereMeta: { shortLabel: "Parkový sektor" },
      spyIntel: { revealedTypeDistrictIds: [7] }
    });
    expect(revealed.typeLabel).toBe("Parkový sektor");
    expect(revealed.ownerAvatarHidden).toBe(false);
    expect(revealed.ownerFallback).toBe("");
    expect(revealed.ownerAvatarEmpty).toBe(true);
  });

  it("shows player avatars in hidden owned sectors without fallback letters", () => {
    const hiddenForeign = buildSelectedDistrictSummaryViewModel({ id: 8, districtType: "park" }, {
      gamePhase: "live",
      ownedDistrictIds: new Set(),
      launchOwnerByDistrictId: new Map([[8, 2]]),
      destroyedDistrictIds: new Set()
    }, {
      currentPlayerId: 1,
      atmosphereMeta: { shortLabel: "Parkový sektor" },
      getLaunchPlayerAvatar: (id) => `../avatar-${id}.png`,
      spyIntel: { revealedTypeDistrictIds: [] }
    });

    expect(hiddenForeign.typeLabel).toBe("Neznámý sektor");
    expect(hiddenForeign.ownerAvatarHidden).toBe(false);
    expect(hiddenForeign.ownerAvatarSrc).toBe("../avatar-2.png");
    expect(hiddenForeign.ownerFallback).toBe("");

    const ownedByCurrentPlayer = buildSelectedDistrictSummaryViewModel({ id: 9, districtType: "resident" }, {
      gamePhase: "live",
      ownedDistrictIds: new Set([9]),
      launchOwnerByDistrictId: new Map(),
      destroyedDistrictIds: new Set()
    }, {
      currentPlayerId: 1,
      currentPlayerLabel: "TY",
      atmosphereMeta: { shortLabel: "Rezidence" },
      getLaunchPlayerAvatar: (id) => `../avatar-${id}.png`,
      spyIntel: { revealedTypeDistrictIds: [] }
    });

    expect(ownedByCurrentPlayer.typeLabel).toBe("Rezidence");
    expect(ownedByCurrentPlayer.ownerLabel).toBe("TY");
    expect(ownedByCurrentPlayer.ownerAvatarHidden).toBe(false);
    expect(ownedByCurrentPlayer.ownerAvatarSrc).toBe("../avatar-1.png");
    expect(ownedByCurrentPlayer.ownerFallback).toBe("");
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

  it("preserves no-spies disabled button state for spy actions", () => {
    const model = buildDistrictActionViewModel({ id: 9 }, {
      activePoliceAction: null,
      resolvedActions: [
        {
          id: "spy",
          label: "Špehovat",
          enabled: false,
          stacked: true,
          subtitle: "Žádní špehové",
          disabledTone: "no-spies",
          title: "Žádní špehové nejsou dostupní.",
          reason: ""
        }
      ]
    });

    expect(model.actions[0]).toMatchObject({
      id: "spy",
      enabled: false,
      stacked: true,
      subtitle: "Žádní špehové",
      disabledTone: "no-spies",
      title: "Žádní špehové nejsou dostupní.",
      reason: ""
    });
  });

  it("shows only a district occupation status while occupation cooldown is running", () => {
    const model = buildDistrictActionViewModel({ id: 4 }, {
      activePoliceAction: null,
      statusMessage: "District 4 je obsazován.",
      resolvedActions: [],
      actionCountdowns: {
        occupy: { label: "Zbývá 2:10", endsAt: 130000 }
      }
    });

    expect(model.hidden).toBe(false);
    expect(model.headHidden).toBe(true);
    expect(model.statusMessage).toBe("District 4 je obsazován.");
    expect(model.actions).toEqual([]);
  });

  it("keeps downtown lock notice visible without suppressing other actions", () => {
    const model = buildDistrictActionViewModel({ id: 79, districtType: "downtown" }, {
      activePoliceAction: null,
      noticeMessage: "District 79 je downtown a je uzavřený. Obsazení bude možné až ve final lockdown fázi.",
      resolvedActions: [
        { id: "rob", label: "Vykrást district", enabled: true, reason: "" }
      ]
    });

    expect(model.hidden).toBe(false);
    expect(model.noticeMessage).toContain("final lockdown");
    expect(model.actions).toHaveLength(1);
    expect(model.actions[0]).toMatchObject({ id: "rob", enabled: true });
  });
});
