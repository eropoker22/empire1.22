import { describe, expect, it } from "vitest";
import {
  findServerBuildingByType,
  getServerBuildingShortcutCandidateDistrictIds
} from "../../page-assets/js/app/runtime/serverBuildingShortcutResolver.js";

describe("server building shortcut resolver", () => {
  it("finds canonical production types in the selected server district", () => {
    expect(findServerBuildingByType({
      district: {
        buildings: [{
          buildingId: "building:drug-lab:1",
          buildingTypeId: "drug-lab"
        }]
      }
    }, "druglab")).toMatchObject({
      buildingId: "building:drug-lab:1"
    });
  });

  it("searches known, selected, hinted and remaining owned districts in order", () => {
    expect(getServerBuildingShortcutCandidateDistrictIds({
      player: {
        playerId: "player:1",
        homeDistrictId: "district:1",
        factoryProduction: { districtId: "district:4" }
      },
      district: {
        districtId: "district:2",
        ownerPlayerId: "player:1",
        isOwnedByPlayer: true
      },
      districts: [
        { districtId: "district:1", isOwnedByPlayer: true, filledSlotCount: 2 },
        { districtId: "district:2", isOwnedByPlayer: true, filledSlotCount: 1 },
        { districtId: "district:3", isOwnedByPlayer: true, filledSlotCount: 4 },
        { districtId: "district:4", isOwnedByPlayer: true, filledSlotCount: 3 },
        { districtId: "district:5", ownerPlayerId: "player:2", filledSlotCount: 8 }
      ]
    }, "factory", "district:3")).toEqual([
      "district:3",
      "district:2",
      "district:4",
      "district:1"
    ]);
  });

  it("ignores a stale known district that is no longer owned", () => {
    expect(getServerBuildingShortcutCandidateDistrictIds({
      player: {
        playerId: "player:1",
        homeDistrictId: "district:1"
      },
      district: {
        districtId: "district:1",
        isOwnedByPlayer: true
      },
      districts: [
        { districtId: "district:1", isOwnedByPlayer: true, filledSlotCount: 1 },
        { districtId: "district:9", ownerPlayerId: "player:2", filledSlotCount: 5 }
      ]
    }, "pharmacy", "district:9")).toEqual(["district:1"]);
  });
});
