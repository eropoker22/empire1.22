import { describe, expect, it } from "vitest";
import {
  parseUiParityDebugBuildingTypes,
  selectUiParityDebugBuildingMatrix
} from "../e2e/helpers/uiParityDebugBuildingFilter.js";

const matrix = Object.freeze([
  Object.freeze({
    key: "industrial",
    districtIds: Object.freeze(["district:3"]),
    expectedDistrictBuildingTypeIds: Object.freeze(["factory", "recycling_center"]),
    coveredBuildingTypeIds: Object.freeze(["factory", "recycling_center"])
  }),
  Object.freeze({
    key: "commercial",
    districtIds: Object.freeze(["district:95"]),
    expectedDistrictBuildingTypeIds: Object.freeze(["car_dealer", "exchange"]),
    coveredBuildingTypeIds: Object.freeze(["car_dealer", "exchange"])
  })
]);

describe("UI parity debug building filter", () => {
  it("returns the comprehensive matrix unchanged by default", () => {
    const selected = selectUiParityDebugBuildingMatrix(
      matrix,
      parseUiParityDebugBuildingTypes("")
    );

    expect(selected).toBe(matrix);
  });

  it("selects only requested building types while retaining district expectations", () => {
    const selected = selectUiParityDebugBuildingMatrix(
      matrix,
      parseUiParityDebugBuildingTypes(" factory, exchange, factory ")
    );

    expect(selected).toEqual([
      expect.objectContaining({
        key: "industrial",
        expectedDistrictBuildingTypeIds: ["factory", "recycling_center"],
        coveredBuildingTypeIds: ["factory"]
      }),
      expect.objectContaining({
        key: "commercial",
        expectedDistrictBuildingTypeIds: ["car_dealer", "exchange"],
        coveredBuildingTypeIds: ["exchange"]
      })
    ]);
  });

  it("rejects building types outside the spawn-reachable matrix", () => {
    expect(() => selectUiParityDebugBuildingMatrix(
      matrix,
      parseUiParityDebugBuildingTypes("casino")
    )).toThrow("Unknown spawn-reachable UI parity building type(s): casino.");
  });
});
