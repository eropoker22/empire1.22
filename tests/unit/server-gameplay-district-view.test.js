import { describe, expect, it } from "vitest";
import {
  createServerGameplayDistrictView
} from "../../page-assets/js/app/ui/serverGameplayDistrictView.js";

function createFixture({
  buildingSummary = "2 pevných budov",
  intelKnown = true,
  status = "claimed",
  zone = "commercial"
} = {}) {
  const building = {
    buildingId: "building:district-21:pharmacy:1",
    buildingTypeId: "pharmacy",
    label: "Lékárna",
    typeLabel: "Lékárna"
  };
  return {
    readModel: {
      player: {
        playerId: "player:1",
        factionId: "mafia",
        avatarSrc: "../img/avatars/Mafia/2854d1df-0f7c-4fe4-aa85-7a70dfe299db.jpg",
        profile: {}
      },
      leaderboard: {
        currentPlayer: {
          playerId: "player:1",
          name: "Owner"
        },
        entries: []
      },
      district: {
        districtId: "district:21",
        name: "District 21",
        zone,
        status,
        ownerPlayerId: "player:1",
        isOwnedByPlayer: true,
        intelKnown,
        heat: 0,
        influence: 1,
        buildings: [building],
        targetActions: {}
      },
      economyRates: {
        selectedDistrict: {
          districtId: "district:21",
          cleanCashPerHour: 100,
          dirtyCashPerHour: 25,
          influencePerHour: 1,
          passivePopulationSources: []
        }
      }
    },
    renderState: {
      districtPanel: {
        districtId: "district:21",
        title: "District 21",
        zoneLabel: "Komerce",
        statusLabel: status,
        ownershipLabel: "Vlastní hráč",
        heatLabel: "0",
        influenceLabel: "1",
        intelKnown,
        buildingSummary,
        buildings: intelKnown ? [building] : []
      }
    }
  };
}

describe("server gameplay district presentation", () => {
  it("keeps known building metadata identical to demo while retaining authoritative IDs", () => {
    const fixture = createFixture();
    const view = createServerGameplayDistrictView(fixture.readModel, fixture.renderState);

    expect(view?.ownerAvatarSrc).toBe(fixture.readModel.player.avatarSrc);
    expect(view?.ownerAvatarBackgroundUrl).toBe(fixture.readModel.player.avatarSrc);
    expect(view?.buildingMetaText).toBe("");
    expect(view?.buildingEmptyText).toBe("Tento distrikt teď nemá přiřazené žádné budovy.");
    expect(view?.buildings).toEqual([
      expect.objectContaining({
        buildingId: "building:district-21:pharmacy:1",
        buildingTypeId: "pharmacy",
        label: "Lékárna"
      })
    ]);
  });

  it("does not show the lockdown message for hidden non-downtown intel", () => {
    const fixture = createFixture({
      buildingSummary: "Budovy nezjištěny",
      intelKnown: false
    });
    const view = createServerGameplayDistrictView(fixture.readModel, fixture.renderState);

    expect(view?.buildingMetaText).toBe("Nezjištěno");
    expect(view?.buildingEmptyText).toBe("");
    expect(view?.buildingEmptyTone).toBe("");
  });

  it("shows the lockdown message only for hidden downtown intel", () => {
    const fixture = createFixture({
      buildingSummary: "Budovy nezjištěny",
      intelKnown: false,
      zone: "downtown"
    });
    const view = createServerGameplayDistrictView(fixture.readModel, fixture.renderState);

    expect(view?.buildingEmptyText).toBe("Odemkne se až v lockdownu");
    expect(view?.buildingEmptyTone).toBe("lockdown");
  });

  it("uses the exact demo destroyed-district copy", () => {
    const fixture = createFixture({ status: "destroyed" });
    const view = createServerGameplayDistrictView(fixture.readModel, fixture.renderState);

    expect(view?.buildingMetaText).toBe("");
    expect(view?.buildingEmptyText).toBe(
      "V tomhle districtu po totálním zničení nezůstalo nic použitelného."
    );
  });
});
