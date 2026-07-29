import { describe, expect, it } from "vitest";
import {
  LocalDemoBuildingPresentationAdapter,
  ServerBuildingPresentationAdapter
} from "../../page-assets/js/app/runtime/buildingPresentationAdapters.js";
import { createServerDistrictActionPresentation } from "../../page-assets/js/app/runtime/serverDistrictActionPresentation.js";

const localProfile = {
  districtId: 21,
  districtLabel: "District 21",
  typeKey: "commercial",
  buildings: [
    {
      baseName: "Lékárna",
      displayName: "Pulse Pharmacy",
      imagePath: "../img/buildings/pharmacy.png"
    },
    {
      baseName: "Restaurace",
      displayName: "Neon Bite",
      imagePath: "../img/buildings/restaurant.png"
    }
  ]
};

describe("shared building presentation adapters", () => {
  it("keeps local demo presentation unchanged", () => {
    const adapter = new LocalDemoBuildingPresentationAdapter({
      resolveDistrictBuildingProfile: () => localProfile
    });
    expect(adapter.getDistrictPresentation({ id: 21 }).profile).toBe(localProfile);
  });

  it("maps exact authoritative buildings into the same presentation profile", () => {
    const serverBuilding = {
      buildingId: "building:district-21:pharmacy:1",
      buildingTypeId: "pharmacy",
      label: "Lékárna",
      displayName: "Pulse Pharmacy",
      level: 3,
      status: "active"
    };
    const adapter = new ServerBuildingPresentationAdapter({
      getReadModel: () => ({
        player: { playerId: "player:1" },
        district: {
          districtId: "district:21",
          ownerPlayerId: "player:1",
          isOwnedByPlayer: true,
          intelKnown: true,
          status: "claimed",
          zone: "commercial",
          buildings: [serverBuilding]
        }
      }),
      resolveDistrictBuildingProfile: () => localProfile
    });

    const presentation = adapter.getDistrictPresentation({ id: 21 });
    expect(presentation.isOwnedByPlayer).toBe(true);
    expect(presentation.intelKnown).toBe(true);
    expect(presentation.profile.buildings[0]).toMatchObject({
      baseName: "Lékárna",
      buildingId: serverBuilding.buildingId,
      buildingTypeId: "pharmacy",
      displayName: "Pulse Pharmacy",
      imagePath: "../img/buildings/pharmacy.png",
      level: 3
    });
  });

  it("creates the shared detail view for the exact physical server building", () => {
    const firstRestaurant = {
      buildingId: "building:district-21:restaurant:1",
      buildingTypeId: "restaurant",
      label: "Restaurace",
      displayName: "Neon Bite",
      level: 2,
      status: "active"
    };
    const requestedRestaurant = {
      ...firstRestaurant,
      buildingId: "building:district-21:restaurant:2",
      displayName: "Midnight Table",
      level: 4,
      actions: [{
        actionId: "restaurant-host-informant-night",
        label: "Hostit informátora",
        description: "Získá nové informace.",
        enabled: true,
        disabledReason: null,
        expectedEffectSummary: ["Nový intel"],
        riskSummary: [],
        requiresInput: []
      }]
    };
    const adapter = new ServerBuildingPresentationAdapter({
      getReadModel: () => ({
        server: {
          serverInstanceId: "instance:free:test",
          stateVersion: 7
        },
        mode: { tickRateMs: 10_000 },
        player: { playerId: "player:1" },
        district: {
          districtId: "district:21",
          ownerPlayerId: "player:1",
          isOwnedByPlayer: true,
          intelKnown: true,
          status: "claimed",
          zone: "commercial",
          buildings: [firstRestaurant, requestedRestaurant]
        }
      }),
      resolveDistrictBuildingProfile: () => localProfile
    });

    const detail = adapter.getBuildingDetailPresentation(
      { id: 21 },
      { buildingId: requestedRestaurant.buildingId },
      {
        renderState: {
          districtPanel: {
            buildings: [{
              ...requestedRestaurant,
              info: "Serverový popis.",
              role: "Vliv",
              stats: [{ label: "Vliv", value: "+2" }]
            }],
            slots: []
          }
        }
      }
    );

    expect(detail).toMatchObject({
      serverInstanceId: "instance:free:test",
      serverDistrictId: "district:21",
      buildingId: requestedRestaurant.buildingId,
      buildingTypeId: "restaurant",
      displayName: "Midnight Table"
    });
    expect(detail.viewModel).toMatchObject({
      backgroundImagePath: "../img/buildings/restaurant.png",
      levelLabel: "L4",
      stats: [{ label: "Vliv", value: "+2" }]
    });
    expect(detail.viewModel.actions).toHaveLength(1);
  });

  it("does not borrow a local image from an unrelated positional building", () => {
    const adapter = new ServerBuildingPresentationAdapter({
      getReadModel: () => ({
        player: { playerId: "player:1" },
        district: {
          districtId: "district:21",
          ownerPlayerId: "player:1",
          intelKnown: true,
          status: "claimed",
          zone: "commercial",
          buildings: [{
            buildingId: "building:district-21:unknown:1",
            buildingTypeId: "unknown_asset",
            label: "Neznámý asset",
            displayName: "Neznámý asset",
            level: 1,
            status: "active"
          }]
        }
      }),
      resolveDistrictBuildingProfile: () => localProfile
    });

    expect(adapter.getDistrictPresentation({ id: 21 }).profile.buildings[0].imagePath).toBeNull();
  });

  it("never falls back to local buildings for an unscoped server district", () => {
    const adapter = new ServerBuildingPresentationAdapter({
      getReadModel: () => ({ district: { districtId: "district:66", buildings: [] } }),
      resolveDistrictBuildingProfile: () => localProfile
    });
    expect(adapter.getDistrictPresentation({ id: 21 }).profile).toBeNull();
  });
});

describe("server district action presentation", () => {
  it("renders at most one action of each kind for the selected district", () => {
    const readModel = {
      district: {
        districtId: "district:21",
        attackTargets: [
          { districtId: "district:20", enabled: true, disabledReason: null }
        ],
        targetActions: {
          attackTargets: [
            { districtId: "district:21", enabled: false, disabledReason: "Ochrana cíle." }
          ],
          spyTargets: [
            { districtId: "district:21", enabled: true, disabledReason: null }
          ],
          occupyTargets: [],
          robTargets: [
            { districtId: "district:21", enabled: true, disabledReason: null }
          ],
          heistTargets: []
        },
        placeDefense: null,
        removeDefense: null,
        trap: null
      }
    };

    const actions = createServerDistrictActionPresentation(readModel, "district:21");

    expect(actions.map((action) => action.id)).toEqual(["attack", "rob", "spy"]);
    expect(actions.find((action) => action.id === "attack")).toMatchObject({
      enabled: false,
      reason: "Ochrana cíle."
    });
    expect(actions.find((action) => action.id === "rob")).toMatchObject({
      enabled: true,
      label: "Vykrást district"
    });
    expect(actions.filter((action) => action.id === "spy")).toHaveLength(1);
  });
});
