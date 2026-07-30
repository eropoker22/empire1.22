import { describe, expect, it } from "vitest";
import {
  resolveServerSpyDistrictRoute
} from "../../page-assets/js/app/runtime/serverDistrictActionRoute.js";

describe("server district action route", () => {
  it("uses the source district projected with the authoritative spy target", () => {
    expect(resolveServerSpyDistrictRoute({
      district: {
        targetActions: {
          spyTargets: [{
            districtId: "district:25",
            sourceDistrictId: "district:21"
          }]
        }
      }
    }, "district:25")).toEqual({
      sourceDistrictId: "district:21"
    });
  });

  it("prefers the authoritative corridor and forwards its route revision", () => {
    expect(resolveServerSpyDistrictRoute({
      district: {
        spyTargets: [{
          districtId: "district:25",
          sourceDistrictId: "district:21"
        }]
      },
      frontier: {
        corridorTargets: [{
          targetDistrictId: "district:25",
          sourceDistrictId: "district:42",
          routeDistrictId: "district:41",
          routeVersion: 7
        }]
      }
    }, "district:25")).toEqual({
      sourceDistrictId: "district:42",
      routeDistrictId: "district:41",
      expectedRouteVersion: 7
    });
  });

  it("fails closed instead of submitting an empty district source", () => {
    expect(resolveServerSpyDistrictRoute({
      district: {
        targetActions: {
          spyTargets: [{
            districtId: "district:25",
            sourceDistrictId: ""
          }]
        }
      }
    }, "district:25")).toBeNull();
  });
});
