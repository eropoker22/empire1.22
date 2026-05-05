import { describe, expect, it } from "vitest";
import {
  buildAttackOrderMarkers,
  buildMapMissionMarkersViewModel,
  buildOccupyOrderMarkers,
  buildPoliceActionMarkers,
  buildRobberyOrderMarkers,
  buildSpyMissionMarkers,
  buildTrapDistrictMarkers,
  getMissionDistrictId
} from "../../page-assets/js/app/map/mapMissionMarkersViewModel.js";

describe("map mission marker view-model builders", () => {
  it("normalizes district ids from numeric and prefixed refs", () => {
    expect(getMissionDistrictId("district:12")).toBe(12);
    expect(getMissionDistrictId(8)).toBe(8);
    expect(getMissionDistrictId("bad")).toBe(0);
  });

  it("builds spy markers only from visible missions", () => {
    const markers = buildSpyMissionMarkers([
      { targetDistrictId: 4, createdAt: "2026-05-05T00:00:00.000Z", returnAt: "2026-05-05T00:00:10.000Z", visible: true },
      { targetDistrictId: 5, createdAt: "2026-05-05T00:00:00.000Z", returnAt: "2026-05-05T00:00:10.000Z", visible: false }
    ], {
      now: 1000,
      isSpyMissionActiveOnMap: (mission) => mission.visible,
      getSpyMissionExpiryTimestamp: (mission) => new Date(mission.returnAt).getTime()
    });

    expect(Array.from(markers.districtIds)).toEqual([4]);
    expect(markers.markersByDistrictId.get(4)).toMatchObject({
      seed: 4,
      startedAt: new Date("2026-05-05T00:00:00.000Z").getTime(),
      expiresAt: new Date("2026-05-05T00:00:10.000Z").getTime()
    });
  });

  it("builds police, attack, occupy, robbery and trap markers", () => {
    const police = buildPoliceActionMarkers({
      2: { districtId: 2, type: "raid" },
      bad: null
    });
    expect(Array.from(police.districtIds)).toEqual([2]);
    expect(police.markersByDistrictId.get(2)).toMatchObject({ type: "raid" });

    const attack = buildAttackOrderMarkers([{
      targetDistrictId: "district:7",
      sourceDistrictId: "district:3",
      status: "cooldown",
      createdAt: "2026-05-05T00:00:00.000Z",
      resolveAt: "2026-05-05T00:00:20.000Z"
    }], { now: 1000, cooldownMs: 30_000 });
    expect(Array.from(attack.districtIds)).toEqual([7]);
    expect(attack.markersByDistrictId.get(7)).toMatchObject({
      seed: 7,
      source: "cooldown",
      attackerDistrictId: 3
    });

    const occupy = buildOccupyOrderMarkers([{
      targetDistrictId: "district:9",
      createdAt: new Date(1000).toISOString(),
      resolveAt: new Date(11_000).toISOString()
    }], { now: 1000 });
    expect(Array.from(occupy.districtIds)).toEqual([9]);
    expect(occupy.countdownByDistrictId.get(9)).toBe(10);

    const robbery = buildRobberyOrderMarkers([{
      targetDistrictId: "district:6",
      createdAt: "2026-05-05T00:00:00.000Z",
      resolveAt: "2026-05-05T00:00:15.000Z"
    }], { now: 1000, cooldownMs: 25_000 });
    expect(Array.from(robbery.districtIds)).toEqual([6]);
    expect(robbery.markersByDistrictId.get(6)).toMatchObject({ seed: 6 });

    const trap = buildTrapDistrictMarkers({
      districtTrapById: {
        1: { isArmed: true },
        2: { isArmed: false }
      }
    });
    expect(Array.from(trap.districtIds)).toEqual([1]);
  });

  it("builds the full runtime marker payload without mutating inputs", () => {
    const worldState = { districtTrapById: { 10: { isArmed: true } } };
    const payload = buildMapMissionMarkersViewModel({
      spyMissions: [{ targetDistrictId: 1, createdAt: new Date(0).toISOString(), returnAt: new Date(5000).toISOString() }],
      policeActions: { 2: { districtId: 2 } },
      attackOrders: [{ targetDistrictId: "district:3", sourceDistrictId: "district:1", createdAt: new Date(0).toISOString() }],
      occupyOrders: [{ targetDistrictId: "district:4", createdAt: new Date(0).toISOString(), resolveAt: new Date(4000).toISOString() }],
      robberyOrders: [{ targetDistrictId: "district:5", createdAt: new Date(0).toISOString() }],
      worldState,
      now: 1000,
      attackCooldownMs: 30_000,
      robberyCooldownMs: 20_000,
      isSpyMissionActiveOnMap: () => true,
      getSpyMissionExpiryTimestamp: (mission) => new Date(mission.returnAt).getTime()
    });

    expect(Array.from(payload.activeSpyDistrictIds)).toEqual([1]);
    expect(Array.from(payload.activePoliceDistrictIds)).toEqual([2]);
    expect(Array.from(payload.activeAttackDistrictIds)).toEqual([3]);
    expect(Array.from(payload.activeOccupyDistrictIds)).toEqual([4]);
    expect(Array.from(payload.activeRobberyDistrictIds)).toEqual([5]);
    expect(Array.from(payload.activeTrapDistrictIds)).toEqual([10]);
    expect(worldState.districtTrapById[10].isArmed).toBe(true);
  });
});
