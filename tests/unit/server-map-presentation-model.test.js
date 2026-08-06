import { describe, expect, it } from "vitest";
import {
  createServerMapPresentationModel,
  resolveServerMapDistrictId
} from "../../page-assets/js/app/map/serverMapPresentationModel.js";

const createSlice = (overrides = {}) => ({
  server: {
    selectedDistrictId: "district:2",
    mapManifestId: "empire-city",
    mapManifestVersion: 3,
    mapManifestHash: "manifest-hash"
  },
  player: {
    playerId: "player:1",
    color: "#11ccff",
    factionId: "mafia",
    economy: { cleanCash: 100, dirtyCash: 50 },
    dayNight: { uiThemeHint: "night" },
    police: null
  },
  districts: [
    {
      districtId: "district:1",
      name: "Dockyard",
      zone: "industrial",
      ownerPlayerId: "player:1",
      ownerColor: "#11ccff",
      isOwnedByPlayer: true,
      status: "claimed",
      heat: 2,
      influence: 4
    },
    {
      districtId: "district:2",
      name: "Old Town",
      zone: "downtown",
      ownerPlayerId: "player:2",
      ownerColor: "#ff3388",
      isOwnedByPlayer: false,
      status: "destroyed",
      heat: 8,
      influence: 9
    }
  ],
  district: { districtId: "district:2" },
  reports: [],
  ...overrides
});

describe("server map presentation model", () => {
  it("normalizes canonical ids without mutating authority state", () => {
    const slice = createSlice();
    const model = createServerMapPresentationModel(slice, { now: 1_000 });

    expect(resolveServerMapDistrictId("district:161")).toBe(161);
    expect(model.gameplaySlice).toBe(slice);
    expect(model.selectedDistrictId).toBe(2);
    expect(model.phase).toBe("night");
    expect(model.ownedDistrictIds).toEqual(new Set([1]));
    expect(model.destroyedDistrictIds).toEqual(new Set([2]));
    expect(model.districtOwnerById).toEqual({ 1: "player:1" });
    expect(model.ownerColorByPlayerId.get("player:1")).toBe("#11ccff");
    expect(model.rawDistrictIdById.get(2)).toBe("district:2");
  });

  it("keeps cash outside map fingerprints", () => {
    const previous = createServerMapPresentationModel(createSlice());
    const next = createServerMapPresentationModel(createSlice({
      player: {
        ...createSlice().player,
        economy: { cleanCash: 999, dirtyCash: 50 }
      }
    }));

    expect(next.fingerprints).toEqual(previous.fingerprints);
  });

  it("normalizes server effects into renderer-only marker state", () => {
    const now = Date.now();
    const model = createServerMapPresentationModel(createSlice({
      mapEffects: [{
        type: "attack-district",
        districtId: "district:1",
        playerName: "Neon Wolves",
        startedAt: now,
        expiresAt: now + 5_000
      }]
    }), { now });

    expect(model.effects.activeAttackDistrictIds).toEqual(new Set([1]));
    expect(model.effects.activeAttackMarkersByDistrictId.get(1)).toMatchObject({
      playerName: "Neon Wolves",
      startedAt: now,
      expiresAt: now + 5_000
    });
  });
});
