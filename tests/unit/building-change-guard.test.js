import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  publicBuildingDefinitions
} from "../../packages/game-config/src/public/building-definitions";
import {
  publicBuildingNameVariants
} from "../../packages/game-config/src/public/building-name-variants";
import {
  publicDistrictBuildingSetPools
} from "../../packages/game-config/src/public/district-building-sets";

const root = process.cwd();
const read = (relativePath) => readFileSync(resolve(root, relativePath), "utf8");
const removedBuildingIds = ["data_center", "brainwash_center", "taxi_service"];

describe("building change guard", () => {
  it("keeps district building sets aligned with the public catalog", () => {
    const publicBuildingIds = new Set(publicBuildingDefinitions.map((definition) => definition.buildingTypeId));

    for (const [zone, sets] of Object.entries(publicDistrictBuildingSetPools)) {
      expect(sets.length, `${zone} should have building sets`).toBeGreaterThan(0);
      for (const set of sets) {
        for (const buildingTypeId of set.buildingTypes) {
          expect(publicBuildingIds.has(buildingTypeId), `${set.key} references ${buildingTypeId}`).toBe(true);
        }
      }
    }
  });

  it("keeps every public building backed by non-empty display name variants", () => {
    for (const definition of publicBuildingDefinitions) {
      const variants = publicBuildingNameVariants[definition.buildingTypeId];

      expect(Array.isArray(variants), definition.buildingTypeId).toBe(true);
      expect(variants.length, definition.buildingTypeId).toBeGreaterThan(0);
      expect(definition.nameVariants.length, definition.buildingTypeId).toBeGreaterThan(0);
    }
  });

  it("keeps removed buildings out of canonical source paths", () => {
    const canonicalSources = [
      "packages/game-config/src/public/building-definitions.ts",
      "packages/game-config/src/public/building-name-variants.ts",
      "packages/game-config/src/public/district-building-sets.ts",
      "packages/game-config/src/modes/free/free-mode.override.ts",
      "packages/game-core/src/contracts/game-mode-config.ts",
      "packages/game-config/src/contracts/balance-config.ts",
      "page-assets/js/app/runtime.js",
      "page-assets/js/app/runtime/buildingDisplayData.js"
    ];
    const source = canonicalSources.map(read).join("\n");

    for (const buildingId of removedBuildingIds) {
      expect(source).not.toContain(buildingId);
    }
  });

  it("keeps focused integration coverage for recently added free-mode buildings", () => {
    const integrationSource = read("tests/integration/game-core/building-action-flow.test.ts");
    const requiredCoverageMarkers = [
      "car_dealer",
      "fitness_club",
      "school",
      "smuggling_tunnel"
    ];

    for (const buildingTypeId of requiredCoverageMarkers) {
      expect(integrationSource).toContain(buildingTypeId);
    }
  });
});
