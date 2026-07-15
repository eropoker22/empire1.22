import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  publicBuildingDefinitions
} from "../../packages/game-config/src/public/building-definitions";
import {
  publicBuildingDefinitions as clientPublicBuildingDefinitions
} from "../../client/packages/game-config/src/public/building-definitions";
import {
  publicBuildingNameVariants
} from "../../packages/game-config/src/public/building-name-variants";
import {
  publicDistrictBuildingSetPools,
  resolveDistrictBuildingTypes
} from "../../packages/game-config/src/public/district-building-sets";
import { freeModeCarDealerConfig } from "../../packages/game-config/src/public/free-mode-car-dealer-config";
import { freeModeConvenienceStoreConfig } from "../../packages/game-config/src/public/free-mode-convenience-store-config";
import { freeModeExchangeOfficeConfig } from "../../packages/game-config/src/public/free-mode-exchange-office-config";
import { freeModeSmugglingTunnelConfig } from "../../packages/game-config/src/public/free-mode-smuggling-tunnel-config";
import { freeModeStreetDealersConfig } from "../../packages/game-config/src/public/free-mode-street-dealers-config";
import { freeModeStripClubConfig } from "../../packages/game-config/src/public/free-mode-strip-club-config";
import { freeModeCarDealerConfig as clientFreeModeCarDealerConfig } from "../../client/packages/game-config/src/public/free-mode-car-dealer-config";
import { freeModeConvenienceStoreConfig as clientFreeModeConvenienceStoreConfig } from "../../client/packages/game-config/src/public/free-mode-convenience-store-config";
import { freeModeExchangeOfficeConfig as clientFreeModeExchangeOfficeConfig } from "../../client/packages/game-config/src/public/free-mode-exchange-office-config";
import { freeModeSmugglingTunnelConfig as clientFreeModeSmugglingTunnelConfig } from "../../client/packages/game-config/src/public/free-mode-smuggling-tunnel-config";
import { STREET_DEALERS_CONFIG } from "../../packages/game-config/src/legacy-page/gameplay-config.generated.js";
import { freeModeStripClubConfig as clientFreeModeStripClubConfig } from "../../client/packages/game-config/src/public/free-mode-strip-club-config";

const root = process.cwd();
const read = (relativePath) => readFileSync(resolve(root, relativePath), "utf8");
const removedBuildingIds = ["data_center", "brainwash_center", "taxi_service"];
const byId = (definitions, buildingTypeId) => definitions.find((definition) => definition.buildingTypeId === buildingTypeId);

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

  it("keeps every downtown public building represented in downtown building sets", () => {
    const downtownBuildingIds = publicBuildingDefinitions
      .filter((definition) => definition.zone === "downtown")
      .map((definition) => definition.buildingTypeId);
    const downtownSetBuildingIds = new Set(
      (publicDistrictBuildingSetPools.downtown ?? []).flatMap((set) => set.buildingTypes)
    );

    for (const buildingTypeId of downtownBuildingIds) {
      expect(downtownSetBuildingIds.has(buildingTypeId), `downtown sets should include ${buildingTypeId}`).toBe(true);
    }
  });

  it("keeps public resident district building resolution aligned with the playable map", () => {
    const mapManifest = JSON.parse(read("packages/game-config/src/maps/empire-streets-city-map.json"));
    const residentDistricts = (mapManifest.districts || []).filter((district) => district.zone === "residential");
    const counts = new Map();
    const schoolApartmentConflicts = [];

    for (const district of residentDistricts) {
      const buildingTypes = resolveDistrictBuildingTypes({
        districtId: String(district.legacyId),
        zone: district.zone
      });
      for (const buildingType of buildingTypes) {
        counts.set(buildingType, (counts.get(buildingType) || 0) + 1);
      }
      if (buildingTypes.includes("school") && buildingTypes.includes("apartment_block")) {
        schoolApartmentConflicts.push({ districtId: district.legacyId, buildingTypes });
      }
    }

    expect(residentDistricts).toHaveLength(38);
    expect(Object.fromEntries([...counts.entries()].sort())).toEqual({
      apartment_block: 29,
      arcade: 16,
      clinic: 8,
      garage: 16,
      recruitment_center: 16,
      school: 6
    });
    expect(schoolApartmentConflicts).toEqual([]);
  });

  it("keeps every public building backed by non-empty display name variants", () => {
    for (const definition of publicBuildingDefinitions) {
      const variants = publicBuildingNameVariants[definition.buildingTypeId];

      expect(Array.isArray(variants), definition.buildingTypeId).toBe(true);
      expect(variants.length, definition.buildingTypeId).toBeGreaterThan(0);
      expect(definition.nameVariants.length, definition.buildingTypeId).toBeGreaterThan(0);
    }
  });

  it("keeps commercial public definitions and client mirror aligned", () => {
    const commercialBuildingIds = [
      "restaurant",
      "fitness_club",
      "pharmacy",
      "exchange",
      "car_dealer",
      "shopping_mall",
      "casino"
    ];

    for (const buildingTypeId of commercialBuildingIds) {
      const canonical = byId(publicBuildingDefinitions, buildingTypeId);
      const client = byId(clientPublicBuildingDefinitions, buildingTypeId);

      expect(client?.stats, buildingTypeId).toEqual(canonical?.stats);
      expect(client?.specialActions.map((action) => action.actionId), buildingTypeId).toEqual(
        canonical?.specialActions.map((action) => action.actionId)
      );
    }

    expect(clientFreeModeCarDealerConfig.cleanCashPerMinute).toBe(freeModeCarDealerConfig.cleanCashPerMinute);
    expect(clientFreeModeCarDealerConfig.dirtyCashPerMinute).toBe(freeModeCarDealerConfig.dirtyCashPerMinute);
    expect(clientFreeModeCarDealerConfig.heatPerMinute).toBe(freeModeCarDealerConfig.heatPerMinute);
    expect(clientFreeModeCarDealerConfig.influencePerMinute).toBe(freeModeCarDealerConfig.influencePerMinute);
    expect(clientFreeModeCarDealerConfig.mobility.fullBonusActionCategories).toEqual(
      freeModeCarDealerConfig.mobility.fullBonusActionCategories
    );
    expect(clientFreeModeCarDealerConfig.escapeChance.appliesTo).toEqual(freeModeCarDealerConfig.escapeChance.appliesTo);

    expect(clientFreeModeExchangeOfficeConfig.countOnMap).toBe(freeModeExchangeOfficeConfig.countOnMap);
    expect(clientFreeModeExchangeOfficeConfig.heatPerMinute).toBe(freeModeExchangeOfficeConfig.heatPerMinute);
    expect(clientFreeModeExchangeOfficeConfig.influencePerMinute).toBe(freeModeExchangeOfficeConfig.influencePerMinute);
    expect(clientFreeModeExchangeOfficeConfig.goodRate).toEqual(freeModeExchangeOfficeConfig.goodRate);
  });

  it("keeps park public definitions and client mirror aligned except drug lab", () => {
    const parkBuildingIds = [
      "street_dealers",
      "convenience_store",
      "smuggling_tunnel",
      "strip_club"
    ];

    for (const buildingTypeId of parkBuildingIds) {
      const canonical = byId(publicBuildingDefinitions, buildingTypeId);
      const client = byId(clientPublicBuildingDefinitions, buildingTypeId);

      expect(client?.stats, buildingTypeId).toEqual(canonical?.stats);
      expect(client?.specialActions.map((action) => action.actionId), buildingTypeId).toEqual(
        canonical?.specialActions.map((action) => action.actionId)
      );
    }

    // The deployed browser reads the generated adapter, not a copied typed-mode module.
    expect(STREET_DEALERS_CONFIG).toEqual(freeModeStreetDealersConfig);
    expect(clientFreeModeConvenienceStoreConfig).toEqual(freeModeConvenienceStoreConfig);
    expect(clientFreeModeSmugglingTunnelConfig).toEqual(freeModeSmugglingTunnelConfig);
    expect(clientFreeModeStripClubConfig).toEqual(freeModeStripClubConfig);
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
