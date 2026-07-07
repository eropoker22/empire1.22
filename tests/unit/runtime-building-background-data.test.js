import { describe, expect, it } from "vitest";

import { DISTRICT_BUILDING_VARIANT_NAMES_BY_BASE_NAME } from "../../page-assets/js/app/runtime/buildingDisplayData.js";
import { DISTRICT_BUILDING_BACKGROUND_IMAGE_BY_VARIANT_NAME } from "../../page-assets/js/app/runtime/buildingBackgroundData.js";

describe("building background data", () => {
  it("keeps building variant names unique within each building type", () => {
    for (const [baseName, variants] of Object.entries(DISTRICT_BUILDING_VARIANT_NAMES_BY_BASE_NAME)) {
      const normalized = variants.map((name) => String(name || "").trim().toLowerCase());
      expect(new Set(normalized).size, `${baseName} contains duplicate variant names`).toBe(normalized.length);
      expect(normalized.every(Boolean), `${baseName} contains an empty variant name`).toBe(true);
    }
  });

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

    expect(malls).toHaveLength(10);
    expect(assignedBackgrounds).toHaveLength(10);
    expect(assignedBackgrounds.every(Boolean)).toBe(true);

    const counts = assignedBackgrounds.reduce((accumulator, imagePath) => {
      accumulator[imagePath] = (accumulator[imagePath] || 0) + 1;
      return accumulator;
    }, {});

    expect(Object.values(counts).sort((left, right) => right - left)).toEqual([3, 3, 2, 2]);
  });

  it("assigns autosalon backgrounds explicitly and evenly across the available wallpaper set", () => {
    const autoSalons = DISTRICT_BUILDING_VARIANT_NAMES_BY_BASE_NAME.Autosalon || [];
    const assignedBackgrounds = autoSalons.map((name) => DISTRICT_BUILDING_BACKGROUND_IMAGE_BY_VARIANT_NAME[name]);

    expect(autoSalons).toHaveLength(10);
    expect(assignedBackgrounds.every(Boolean)).toBe(true);

    const counts = assignedBackgrounds.reduce((accumulator, imagePath) => {
      accumulator[imagePath] = (accumulator[imagePath] || 0) + 1;
      return accumulator;
    }, {});

    expect(Object.values(counts).sort((left, right) => right - left)).toEqual([3, 3, 2, 2]);
  });

  it("assigns fitness club backgrounds explicitly across the available wallpaper set", () => {
    const fitnessClubs = DISTRICT_BUILDING_VARIANT_NAMES_BY_BASE_NAME["Fitness Club"] || [];
    const assignedBackgrounds = fitnessClubs.map((name) => DISTRICT_BUILDING_BACKGROUND_IMAGE_BY_VARIANT_NAME[name]);

    expect(fitnessClubs).toHaveLength(5);
    expect(assignedBackgrounds).toHaveLength(5);
    expect(assignedBackgrounds.every(Boolean)).toBe(true);

    const counts = assignedBackgrounds.reduce((accumulator, imagePath) => {
      accumulator[imagePath] = (accumulator[imagePath] || 0) + 1;
      return accumulator;
    }, {});

    expect(Object.values(counts).sort((left, right) => right - left)).toEqual([2, 1, 1, 1]);
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

    expect(Object.values(counts).sort((left, right) => right - left)).toEqual([4, 4, 4, 4, 4, 4, 4, 4, 4]);
  });

  it("assigns restaurant backgrounds explicitly and evenly across the available wallpaper set", () => {
    const restaurants = DISTRICT_BUILDING_VARIANT_NAMES_BY_BASE_NAME.Restaurace || [];
    const assignedBackgrounds = restaurants.map((name) => DISTRICT_BUILDING_BACKGROUND_IMAGE_BY_VARIANT_NAME[name]);

    expect(restaurants).toHaveLength(36);
    expect(assignedBackgrounds.every(Boolean)).toBe(true);

    const counts = assignedBackgrounds.reduce((accumulator, imagePath) => {
      accumulator[imagePath] = (accumulator[imagePath] || 0) + 1;
      return accumulator;
    }, {});

    expect(Object.values(counts).sort((left, right) => right - left)).toEqual([5, 5, 5, 5, 4, 4, 4, 4]);
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

    expect(arcades).toHaveLength(16);
    expect(assignedBackgrounds.every(Boolean)).toBe(true);

    const counts = assignedBackgrounds.reduce((accumulator, imagePath) => {
      accumulator[imagePath] = (accumulator[imagePath] || 0) + 1;
      return accumulator;
    }, {});

    expect(Object.values(counts).sort((left, right) => right - left)).toEqual([2, 2, 2, 2, 2, 2, 2, 2]);
  });

  it("assigns recruitment center backgrounds explicitly and evenly across the residential wallpaper set", () => {
    const recruitmentCenters = DISTRICT_BUILDING_VARIANT_NAMES_BY_BASE_NAME["Rekrutační centrum"] || [];
    const assignedBackgrounds = recruitmentCenters.map((name) => DISTRICT_BUILDING_BACKGROUND_IMAGE_BY_VARIANT_NAME[name]);

    expect(recruitmentCenters).toHaveLength(16);
    expect(assignedBackgrounds.every(Boolean)).toBe(true);

    const counts = assignedBackgrounds.reduce((accumulator, imagePath) => {
      accumulator[imagePath] = (accumulator[imagePath] || 0) + 1;
      return accumulator;
    }, {});

    expect(Object.values(counts).sort((left, right) => right - left)).toEqual([4, 4, 4, 4]);
  });

  it("assigns garage backgrounds explicitly and evenly across the residential wallpaper set", () => {
    const garages = DISTRICT_BUILDING_VARIANT_NAMES_BY_BASE_NAME.Garage || [];
    const assignedBackgrounds = garages.map((name) => DISTRICT_BUILDING_BACKGROUND_IMAGE_BY_VARIANT_NAME[name]);

    expect(garages).toHaveLength(16);
    expect(assignedBackgrounds.every(Boolean)).toBe(true);

    const counts = assignedBackgrounds.reduce((accumulator, imagePath) => {
      accumulator[imagePath] = (accumulator[imagePath] || 0) + 1;
      return accumulator;
    }, {});

    expect(Object.values(counts).sort((left, right) => right - left)).toEqual([4, 4, 4, 4]);
  });

  it("assigns street dealer backgrounds explicitly and evenly across the park wallpaper set", () => {
    const streetDealers = DISTRICT_BUILDING_VARIANT_NAMES_BY_BASE_NAME["Pouliční dealeři"] || [];
    const assignedBackgrounds = streetDealers.map((name) => DISTRICT_BUILDING_BACKGROUND_IMAGE_BY_VARIANT_NAME[name]);

    expect(streetDealers).toHaveLength(19);
    expect(assignedBackgrounds.every(Boolean)).toBe(true);

    const counts = assignedBackgrounds.reduce((accumulator, imagePath) => {
      accumulator[imagePath] = (accumulator[imagePath] || 0) + 1;
      return accumulator;
    }, {});

    expect(Object.values(counts).sort((left, right) => right - left)).toEqual([5, 5, 5, 4]);
  });

  it("assigns strip club backgrounds explicitly and evenly across the park wallpaper set", () => {
    const stripClubs = DISTRICT_BUILDING_VARIANT_NAMES_BY_BASE_NAME["Strip club"] || [];
    const assignedBackgrounds = stripClubs.map((name) => DISTRICT_BUILDING_BACKGROUND_IMAGE_BY_VARIANT_NAME[name]);

    expect(stripClubs).toHaveLength(17);
    expect(assignedBackgrounds.every(Boolean)).toBe(true);

    const counts = assignedBackgrounds.reduce((accumulator, imagePath) => {
      accumulator[imagePath] = (accumulator[imagePath] || 0) + 1;
      return accumulator;
    }, {});

    expect(Object.values(counts).sort((left, right) => right - left)).toEqual([3, 3, 3, 2, 2, 2, 2]);
  });

  it("assigns convenience store backgrounds explicitly and evenly across the park wallpaper set", () => {
    const convenienceStores = DISTRICT_BUILDING_VARIANT_NAMES_BY_BASE_NAME["Večerka"] || [];
    const assignedBackgrounds = convenienceStores.map((name) => DISTRICT_BUILDING_BACKGROUND_IMAGE_BY_VARIANT_NAME[name]);

    expect(convenienceStores).toHaveLength(20);
    expect(assignedBackgrounds.every(Boolean)).toBe(true);

    const counts = assignedBackgrounds.reduce((accumulator, imagePath) => {
      accumulator[imagePath] = (accumulator[imagePath] || 0) + 1;
      return accumulator;
    }, {});

    expect(Object.values(counts).sort((left, right) => right - left)).toEqual([3, 3, 3, 3, 2, 2, 2, 2]);
  });

  it("assigns smuggling tunnel backgrounds explicitly and evenly across the park wallpaper set", () => {
    const smugglingTunnels = DISTRICT_BUILDING_VARIANT_NAMES_BY_BASE_NAME["Pašovací tunel"] || [];
    const assignedBackgrounds = smugglingTunnels.map((name) => DISTRICT_BUILDING_BACKGROUND_IMAGE_BY_VARIANT_NAME[name]);

    expect(smugglingTunnels).toHaveLength(18);
    expect(assignedBackgrounds.every(Boolean)).toBe(true);

    const counts = assignedBackgrounds.reduce((accumulator, imagePath) => {
      accumulator[imagePath] = (accumulator[imagePath] || 0) + 1;
      return accumulator;
    }, {});

    expect(Object.values(counts).sort((left, right) => right - left)).toEqual([5, 5, 4, 4]);
  });

  it("assigns warehouse backgrounds explicitly and evenly across the industrial wallpaper set", () => {
    const warehouses = DISTRICT_BUILDING_VARIANT_NAMES_BY_BASE_NAME.Skladiště || [];
    const assignedBackgrounds = warehouses.map((name) => DISTRICT_BUILDING_BACKGROUND_IMAGE_BY_VARIANT_NAME[name]);

    expect(DISTRICT_BUILDING_VARIANT_NAMES_BY_BASE_NAME.Sklad).toEqual(warehouses);
    expect(warehouses).toHaveLength(21);
    expect(assignedBackgrounds.every(Boolean)).toBe(true);

    const counts = assignedBackgrounds.reduce((accumulator, imagePath) => {
      accumulator[imagePath] = (accumulator[imagePath] || 0) + 1;
      return accumulator;
    }, {});

    expect(Object.values(counts).sort((left, right) => right - left)).toEqual([6, 5, 5, 5]);
  });

  it("assigns power station backgrounds explicitly and evenly across the industrial wallpaper set", () => {
    const powerStations = DISTRICT_BUILDING_VARIANT_NAMES_BY_BASE_NAME["Energetická stanice"] || [];
    const assignedBackgrounds = powerStations.map((name) => DISTRICT_BUILDING_BACKGROUND_IMAGE_BY_VARIANT_NAME[name]);

    expect(powerStations).toHaveLength(15);
    expect(assignedBackgrounds.every(Boolean)).toBe(true);

    const counts = assignedBackgrounds.reduce((accumulator, imagePath) => {
      accumulator[imagePath] = (accumulator[imagePath] || 0) + 1;
      return accumulator;
    }, {});

    expect(Object.values(counts).sort((left, right) => right - left)).toEqual([4, 4, 4, 3]);
  });

  it("assigns recycling center backgrounds explicitly and evenly across the industrial wallpaper set", () => {
    const recyclingCenters = DISTRICT_BUILDING_VARIANT_NAMES_BY_BASE_NAME["Recyklační centrum"] || [];
    const assignedBackgrounds = recyclingCenters.map((name) => DISTRICT_BUILDING_BACKGROUND_IMAGE_BY_VARIANT_NAME[name]);

    expect(recyclingCenters).toHaveLength(14);
    expect(assignedBackgrounds.every(Boolean)).toBe(true);

    const counts = assignedBackgrounds.reduce((accumulator, imagePath) => {
      accumulator[imagePath] = (accumulator[imagePath] || 0) + 1;
      return accumulator;
    }, {});

    expect(Object.values(counts).sort((left, right) => right - left)).toEqual([4, 4, 3, 3]);
  });
});
