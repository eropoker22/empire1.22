import { describe, expect, it } from "vitest";
import {
  resolveServerAttackDistrictRoute,
  resolveServerDistrictActionTarget,
  resolveServerOccupyDistrictRoute,
  resolveServerRobDistrictRoute,
  resolveServerSpyDistrictRoute
} from "../../page-assets/js/app/runtime/serverDistrictActionRoute.js";

describe("server district action route", () => {
  it("prefers the opened target projection for every district action", () => {
    expect(resolveServerDistrictActionTarget({
      district: {
        targetActions: {
          robTargets: [{
            districtId: "district:map:25",
            sourceDistrictId: "district:map:21",
            expectedLootPoolRevision: 9
          }]
        },
        robTargets: [{
          districtId: "district:map:25",
          sourceDistrictId: "district:map:99",
          expectedLootPoolRevision: 1
        }]
      }
    }, "rob", "district:map:25")).toMatchObject({
      sourceDistrictId: "district:map:21",
      expectedLootPoolRevision: 9
    });
  });

  it("uses the source district projected with the authoritative spy target", () => {
    expect(resolveServerSpyDistrictRoute({
      district: {
        targetActions: {
          spyTargets: [{
            districtId: "district:25",
            sourceDistrictId: "district:21",
            enabled: true
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
          sourceDistrictId: "district:21",
          enabled: true
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
            sourceDistrictId: "",
            enabled: true
          }]
        }
      }
    }, "district:25")).toBeNull();
  });

  it("routes a rob through exact projected source and concurrency revisions", () => {
    expect(resolveServerRobDistrictRoute({
      district: {
        targetActions: {
          robTargets: [{
            districtId: "district:25",
            sourceDistrictId: "district:21",
            enabled: true,
            expectedConflictRevision: 11,
            expectedLootPoolRevision: 4
          }]
        }
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
      expectedConflictRevision: 11,
      expectedLootPoolRevision: 4,
      routeDistrictId: "district:41",
      expectedRouteVersion: 7
    });
  });

  it("fails closed for explicitly disabled Spy and Rob targets", () => {
    const readModel = {
      district: {
        targetActions: {
          spyTargets: [{
            districtId: "district:25",
            sourceDistrictId: "district:21",
            enabled: false
          }],
          robTargets: [{
            districtId: "district:25",
            sourceDistrictId: "district:21",
            enabled: false,
            expectedConflictRevision: 2
          }]
        }
      }
    };

    expect(resolveServerSpyDistrictRoute(readModel, "district:25")).toBeNull();
    expect(resolveServerRobDistrictRoute(readModel, "district:25")).toBeNull();
  });

  it("does not treat a corridor as permission when the Spy target is absent", () => {
    expect(resolveServerSpyDistrictRoute({
      frontier: {
        corridorTargets: [{
          targetDistrictId: "district:25",
          sourceDistrictId: "district:42",
          routeDistrictId: "district:41",
          routeVersion: 7
        }]
      }
    }, "district:25")).toBeNull();
  });

  it("routes Attack and Occupy only from enabled authoritative projections", () => {
    const readModel = {
      district: {
        targetActions: {
          attackTargets: [{
            districtId: "district:25",
            sourceDistrictId: "district:21",
            enabled: true,
            expectedSourceVersion: 5,
            expectedTargetVersion: 8,
            expectedConflictRevision: 13
          }],
          occupyTargets: [{
            districtId: "district:25",
            sourceDistrictId: "district:21",
            enabled: true,
            expectedConflictRevision: 13
          }]
        }
      },
      frontier: {
        corridorTargets: [{
          targetDistrictId: "district:25",
          sourceDistrictId: "district:42",
          routeDistrictId: "district:41",
          routeVersion: 7
        }]
      }
    };

    expect(resolveServerAttackDistrictRoute(readModel, "district:25")).toEqual({
      sourceDistrictId: "district:42",
      expectedConflictRevision: 13,
      expectedSourceVersion: 5,
      expectedTargetVersion: 8,
      routeDistrictId: "district:41",
      expectedRouteVersion: 7
    });
    expect(resolveServerOccupyDistrictRoute(readModel, "district:25")).toEqual({
      sourceDistrictId: "district:42",
      expectedConflictRevision: 13,
      routeDistrictId: "district:41",
      expectedRouteVersion: 7
    });
  });

  it("fails closed for missing, disabled, or revisionless Attack and Occupy targets", () => {
    const readModel = {
      district: {
        attackTargets: [{
          districtId: "district:25",
          sourceDistrictId: "district:21",
          enabled: false,
          expectedConflictRevision: 1
        }],
        occupyTargets: [{
          districtId: "district:25",
          sourceDistrictId: "district:21",
          enabled: true
        }]
      }
    };

    expect(resolveServerAttackDistrictRoute(readModel, "district:25")).toBeNull();
    expect(resolveServerOccupyDistrictRoute(readModel, "district:25")).toBeNull();
    expect(resolveServerAttackDistrictRoute({}, "district:25")).toBeNull();
    expect(resolveServerOccupyDistrictRoute({}, "district:25")).toBeNull();
  });
});
