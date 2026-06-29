import { describe, expect, it } from "vitest";

import { DISTRICT_BUILDING_VARIANT_NAMES_BY_BASE_NAME } from "../../page-assets/js/app/runtime/buildingDisplayData.js";
import { DISTRICT_BUILDING_BACKGROUND_IMAGE_BY_VARIANT_NAME } from "../../page-assets/js/app/runtime/buildingBackgroundData.js";

describe("building background data", () => {
  it("assigns exchange backgrounds explicitly and evenly across the available wallpaper set", () => {
    const exchanges = DISTRICT_BUILDING_VARIANT_NAMES_BY_BASE_NAME["Směnárna"] || [];
    const assignedBackgrounds = exchanges.map((name) => DISTRICT_BUILDING_BACKGROUND_IMAGE_BY_VARIANT_NAME[name]);

    expect(exchanges).toHaveLength(12);
    expect(assignedBackgrounds.every(Boolean)).toBe(true);

    const counts = assignedBackgrounds.reduce((accumulator, imagePath) => {
      accumulator[imagePath] = (accumulator[imagePath] || 0) + 1;
      return accumulator;
    }, {});

    expect(Object.values(counts).sort((left, right) => right - left)).toEqual([3, 3, 3, 3]);
  });

  it("assigns shopping mall backgrounds explicitly across the available wallpaper set", () => {
    const malls = DISTRICT_BUILDING_VARIANT_NAMES_BY_BASE_NAME["Obchodní centrum"] || [];
    const assignedBackgrounds = malls.map((name) => DISTRICT_BUILDING_BACKGROUND_IMAGE_BY_VARIANT_NAME[name]);

    expect(malls).toHaveLength(3);
    expect(assignedBackgrounds).toHaveLength(3);
    expect(assignedBackgrounds.every(Boolean)).toBe(true);
    expect(new Set(assignedBackgrounds).size).toBe(3);
  });

  it("assigns autosalon backgrounds explicitly and evenly across the available wallpaper set", () => {
    const autoSalons = DISTRICT_BUILDING_VARIANT_NAMES_BY_BASE_NAME.Autosalon || [];
    const assignedBackgrounds = autoSalons.map((name) => DISTRICT_BUILDING_BACKGROUND_IMAGE_BY_VARIANT_NAME[name]);

    expect(autoSalons).toHaveLength(8);
    expect(assignedBackgrounds.every(Boolean)).toBe(true);

    const counts = assignedBackgrounds.reduce((accumulator, imagePath) => {
      accumulator[imagePath] = (accumulator[imagePath] || 0) + 1;
      return accumulator;
    }, {});

    expect(Object.values(counts).sort((left, right) => right - left)).toEqual([2, 2, 2, 2]);
  });

  it("assigns fitness club backgrounds explicitly across the available wallpaper set", () => {
    const fitnessClubs = DISTRICT_BUILDING_VARIANT_NAMES_BY_BASE_NAME["Fitness Club"] || [];
    const assignedBackgrounds = fitnessClubs.map((name) => DISTRICT_BUILDING_BACKGROUND_IMAGE_BY_VARIANT_NAME[name]);

    expect(fitnessClubs).toHaveLength(4);
    expect(assignedBackgrounds).toHaveLength(4);
    expect(assignedBackgrounds.every(Boolean)).toBe(true);
    expect(new Set(assignedBackgrounds).size).toBe(4);
  });

  it("assigns apartment block backgrounds explicitly and evenly across the available wallpaper set", () => {
    const apartmentBlocks = DISTRICT_BUILDING_VARIANT_NAMES_BY_BASE_NAME["Bytový blok"] || [];
    const assignedBackgrounds = apartmentBlocks.map((name) => DISTRICT_BUILDING_BACKGROUND_IMAGE_BY_VARIANT_NAME[name]);

    expect(apartmentBlocks).toHaveLength(36);
    expect(assignedBackgrounds.every(Boolean)).toBe(true);

    const counts = assignedBackgrounds.reduce((accumulator, imagePath) => {
      accumulator[imagePath] = (accumulator[imagePath] || 0) + 1;
      return accumulator;
    }, {});

    expect(Object.values(counts).sort((left, right) => right - left)).toEqual([8, 7, 7, 7, 7]);
  });

  it("assigns restaurant backgrounds explicitly and evenly across the available wallpaper set", () => {
    const restaurants = DISTRICT_BUILDING_VARIANT_NAMES_BY_BASE_NAME.Restaurace || [];
    const assignedBackgrounds = restaurants.map((name) => DISTRICT_BUILDING_BACKGROUND_IMAGE_BY_VARIANT_NAME[name]);

    expect(restaurants).toHaveLength(27);
    expect(assignedBackgrounds.every(Boolean)).toBe(true);

    const counts = assignedBackgrounds.reduce((accumulator, imagePath) => {
      accumulator[imagePath] = (accumulator[imagePath] || 0) + 1;
      return accumulator;
    }, {});

    expect(Object.values(counts).sort((left, right) => right - left)).toEqual([7, 7, 7, 6]);
  });

  it("assigns casino backgrounds explicitly across the available wallpaper set", () => {
    const casinos = DISTRICT_BUILDING_VARIANT_NAMES_BY_BASE_NAME.Kasino || [];
    const assignedBackgrounds = casinos.map((name) => DISTRICT_BUILDING_BACKGROUND_IMAGE_BY_VARIANT_NAME[name]);

    expect(casinos).toHaveLength(4);
    expect(assignedBackgrounds.every(Boolean)).toBe(true);

    const counts = assignedBackgrounds.reduce((accumulator, imagePath) => {
      accumulator[imagePath] = (accumulator[imagePath] || 0) + 1;
      return accumulator;
    }, {});

    expect(Object.values(counts).sort((left, right) => right - left)).toEqual([2, 1, 1]);
  });

  it("assigns arcade backgrounds explicitly and evenly across the residential wallpaper set", () => {
    const arcades = DISTRICT_BUILDING_VARIANT_NAMES_BY_BASE_NAME.Herna || [];
    const assignedBackgrounds = arcades.map((name) => DISTRICT_BUILDING_BACKGROUND_IMAGE_BY_VARIANT_NAME[name]);

    expect(arcades).toHaveLength(7);
    expect(assignedBackgrounds.every(Boolean)).toBe(true);

    const counts = assignedBackgrounds.reduce((accumulator, imagePath) => {
      accumulator[imagePath] = (accumulator[imagePath] || 0) + 1;
      return accumulator;
    }, {});

    expect(Object.values(counts).sort((left, right) => right - left)).toEqual([2, 2, 2, 1]);
  });

  it("assigns recruitment center backgrounds explicitly and evenly across the residential wallpaper set", () => {
    const recruitmentCenters = DISTRICT_BUILDING_VARIANT_NAMES_BY_BASE_NAME["Rekrutační centrum"] || [];
    const assignedBackgrounds = recruitmentCenters.map((name) => DISTRICT_BUILDING_BACKGROUND_IMAGE_BY_VARIANT_NAME[name]);

    expect(recruitmentCenters).toHaveLength(11);
    expect(assignedBackgrounds.every(Boolean)).toBe(true);

    const counts = assignedBackgrounds.reduce((accumulator, imagePath) => {
      accumulator[imagePath] = (accumulator[imagePath] || 0) + 1;
      return accumulator;
    }, {});

    expect(Object.values(counts).sort((left, right) => right - left)).toEqual([3, 3, 3, 2]);
  });
});
