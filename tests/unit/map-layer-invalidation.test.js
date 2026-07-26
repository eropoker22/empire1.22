import { describe, expect, it } from "vitest";
import {
  MAP_RENDER_LAYERS,
  createGameplaySliceMapFingerprints,
  diffGameplaySliceMapLayers,
  resolveMapRenderLayers
} from "../../page-assets/js/app/map/mapLayerInvalidation.js";

const createSlice = (overrides = {}) => ({
  server: { selectedDistrictId: "district:1" },
  player: {
    economy: { cleanCash: 100, dirtyCash: 50, influence: 10 },
    dayNight: { uiThemeHint: "day" },
    police: { heat: 2 }
  },
  districts: [{
    districtId: "district:1",
    ownerPlayerId: "player:1",
    status: "claimed",
    heat: 2,
    influence: 3,
    buildings: []
  }],
  district: { districtId: "district:1" },
  reports: [],
  ...overrides
});

describe("map layer invalidation", () => {
  it("does not invalidate any layer for an equivalent server read model", () => {
    const previous = createGameplaySliceMapFingerprints(createSlice());
    const next = createGameplaySliceMapFingerprints(createSlice());

    expect(diffGameplaySliceMapLayers(previous, next)).toEqual([]);
  });

  it("does not invalidate the map for cash-only or countdown-only UI changes", () => {
    const previousSlice = createSlice();
    const nextSlice = createSlice({
      player: {
        ...previousSlice.player,
        economy: { ...previousSlice.player.economy, cleanCash: 999 }
      }
    });

    expect(diffGameplaySliceMapLayers(
      createGameplaySliceMapFingerprints(previousSlice),
      createGameplaySliceMapFingerprints(nextSlice)
    )).toEqual([]);
    expect(resolveMapRenderLayers("ui:countdown-update")).toEqual([]);
  });

  it("invalidates only selection when the selected district changes", () => {
    const previous = createGameplaySliceMapFingerprints(createSlice());
    const next = createGameplaySliceMapFingerprints(createSlice({
      server: { selectedDistrictId: "district:2" },
      district: { districtId: "district:2" }
    }));

    expect(diffGameplaySliceMapLayers(previous, next)).toEqual([MAP_RENDER_LAYERS.selection]);
  });

  it("invalidates state when district ownership changes", () => {
    const previousSlice = createSlice();
    const nextSlice = createSlice({
      districts: [{
        ...previousSlice.districts[0],
        ownerPlayerId: "player:2"
      }]
    });

    expect(diffGameplaySliceMapLayers(
      createGameplaySliceMapFingerprints(previousSlice),
      createGameplaySliceMapFingerprints(nextSlice)
    )).toEqual([MAP_RENDER_LAYERS.state]);
  });

  it("invalidates only effects when a declared server map effect changes", () => {
    const previous = createSlice();
    const next = createSlice({
      mapEffects: [{
        effectId: "effect:1",
        type: "attack-district",
        districtId: "district:1",
        expiresAt: "2026-07-26T12:00:00.000Z"
      }]
    });

    expect(diffGameplaySliceMapLayers(
      createGameplaySliceMapFingerprints(previous),
      createGameplaySliceMapFingerprints(next)
    )).toEqual([MAP_RENDER_LAYERS.effects]);
  });

  it("invalidates all size-dependent layers on resize", () => {
    expect(resolveMapRenderLayers("resize")).toEqual(Object.values(MAP_RENDER_LAYERS));
  });
});
