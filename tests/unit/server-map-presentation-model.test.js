import { describe, expect, it } from "vitest";
import {
  createServerMapPresentationModel,
  createServerMapEffectsModel,
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

describe("mission-only map projection", () => {
  it("preserves effect output and expiry without reading or fingerprinting districts", () => {
    const slice = createSlice({ mapEffects: [
      { type: "spy", districtId: "district:2", playerId: "player:1", expiresAt: 10_000 },
      { type: "spy", districtId: "district:1", playerId: "player:2", expiresAt: 10_000 },
      { type: "occupy", districtId: "district:3", playerId: "player:1", expiresAt: 15_000 }
    ] });
    const expected = createServerMapPresentationModel(slice, { now: 1_000 }).effects;
    Object.defineProperty(slice, "districts", { get() { throw new Error("Mission frame must not rebuild district data"); } });
    expect(createServerMapEffectsModel(slice, { now: 1_000 })).toEqual(expected);
    // Expired markers remain until an authoritative update; their animation
    // loop may stop, but this projection must not decide a mission's result.
    expect(createServerMapEffectsModel(slice, { now: 10_000 }).activeSpyMarkersByDistrictId.get(2).expiresAt).toBe(10_000);
    expect(createServerMapEffectsModel(slice, { now: 10_000 }).activeOccupyCountdownByDistrictId.get(3)).toBe(5);
    expect(createServerMapEffectsModel(slice, { now: 15_000 }).activeOccupyCountdownByDistrictId.get(3)).toBe(0);
  });
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

  it("highlights only valid successful occupy intel and invalidates the map when it expires", () => {
    const district = { districtId: "district:3", intelKnown: true, status: "neutral", ownerPlayerId: null };
    const partial = createServerMapPresentationModel(createSlice({ districts: [district] }));
    const success = createServerMapPresentationModel(createSlice({ districts: [{ ...district, occupyIntelValid: true }] }));
    expect(partial.revealedDistrictIds).toEqual(new Set([3]));
    expect(partial.occupiableSpyDistrictIds.size).toBe(0);
    expect(success.occupiableSpyDistrictIds).toEqual(new Set([3]));
    expect(partial.fingerprints.state).not.toBe(success.fingerprints.state);
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

  it("activates spy, robbery, trap, and occupy renderer state from one authoritative slice", () => {
    const now = Date.now();
    const model = createServerMapPresentationModel(createSlice({
      mapEffects: [
        { effectId: "spy:1", type: "spy", districtId: "district:1", playerId: "player:1", startedAt: now, expiresAt: now + 5_000 },
        { effectId: "rob:1", type: "robbery", districtId: "district:1", playerId: "player:1", startedAt: now, expiresAt: now + 5_000 },
        { effectId: "trap:1", type: "trap", districtId: "district:1", playerId: "player:1", startedAt: now },
        { effectId: "occupy:1", type: "occupy", districtId: "district:1", playerId: "player:2", startedAt: now, expiresAt: now + 5_000 },
        { effectId: "foreign-spy", type: "spy", districtId: "district:2", playerId: "player:2", startedAt: now, expiresAt: now + 5_000 }
      ]
    }), { now });

    expect(model.effects.activeSpyDistrictIds).toEqual(new Set([1]));
    expect(model.effects.activeRobberyDistrictIds).toEqual(new Set([1]));
    expect(model.effects.activeTrapDistrictIds).toEqual(new Set([1]));
    expect(model.effects.activeOccupyDistrictIds).toEqual(new Set([1]));
  });
});
