import { describe, expect, it } from "vitest";
import {
  empireStreetsCityMapManifest,
  getBuildingTypeIdForLegacyName,
  publicBuildingDefinitions,
  resolveDistrictBuildingTypes
} from "@empire/game-config";
import {
  DISTRICT_BUILDING_DETAIL_PROFILES,
  DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES
} from "../../page-assets/js/app/runtime/buildingDetailData.js";
import {
  ServerBuildingPresentationAdapter
} from "../../page-assets/js/app/runtime/buildingPresentationAdapters.js";
import {
  DISTRICT_BUILDING_PACKAGE_POOLS,
  DISTRICT_FIXED_BUILDING_PACKAGES_BY_DISTRICT_ID,
  DOWNTOWN_FIXED_BUILDING_PACKAGES_BY_DISTRICT_ID
} from "../../page-assets/js/data/districtPools.js";
import {
  BUILDING_DETAIL_LAYOUTS,
  BUILDING_DETAIL_VIEW_MODEL_KEYS,
  pickBuildingDetailPresentationViewModel,
  resolveBuildingDetailLayout,
  resolveBuildingPresentationDefinition,
  resolveBuildingPresentationTypeId
} from "../../page-assets/js/app/runtime/buildingPresentationContract.js";

const productionBuildingTypeIds = new Set(["pharmacy", "drug_lab", "factory", "armory"]);

const normalizeProfileKey = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/gu, "")
  .trim()
  .toLowerCase();

const localPackageBuildingNames = Array.from(new Set([
  ...Object.values(DISTRICT_BUILDING_PACKAGE_POOLS)
    .flatMap((tiers) => Object.values(tiers))
    .flatMap((sets) => sets)
    .flatMap((set) => set.buildings),
  ...Object.values(DISTRICT_FIXED_BUILDING_PACKAGES_BY_DISTRICT_ID)
    .flatMap((set) => set.buildings),
  ...Object.values(DOWNTOWN_FIXED_BUILDING_PACKAGES_BY_DISTRICT_ID)
    .flatMap((set) => set.buildings)
]));

const localBaseNameByBuildingTypeId = new Map(
  localPackageBuildingNames.map((baseName) => [
    getBuildingTypeIdForLegacyName(baseName),
    baseName
  ])
);

function createServerDetailForDefinition(definition) {
  const presentation = resolveBuildingPresentationDefinition(definition.buildingTypeId);
  const buildingId = `building:district-1:${definition.buildingTypeId}:1`;
  const actions = definition.specialActions.map((action) => ({
    ...action,
    enabled: true,
    disabledReason: null,
    inputSummary: [],
    outputSummary: [],
    riskSummary: [],
    requiresInput: []
  }));
  const building = {
    buildingId,
    buildingTypeId: definition.buildingTypeId,
    label: presentation.baseName,
    displayName: presentation.baseName,
    level: 1,
    maxLevel: Math.max(1, Number(definition.stats.maxLevel || 1)),
    status: "active",
    stats: [],
    actions
  };
  const localProfile = {
    districtId: 1,
    districtLabel: "District 1",
    typeKey: definition.zone,
    typeLabel: definition.zone,
    typeShortLabel: definition.zone,
    setKey: "contract-matrix",
    setTitle: "Contract matrix",
    tier: "mid",
    buildings: [{
      baseName: presentation.baseName,
      displayName: presentation.baseName,
      imagePath: `/contract/${definition.buildingTypeId}.webp`
    }]
  };
  const adapter = new ServerBuildingPresentationAdapter({
    getReadModel: () => ({
      server: {
        serverInstanceId: "instance:contract-matrix",
        stateVersion: 1
      },
      mode: { tickRateMs: 5_000 },
      player: {
        playerId: "player:contract-matrix",
        dayNight: { phaseId: "day" }
      },
      district: {
        districtId: "district:1",
        ownerPlayerId: "player:contract-matrix",
        isOwnedByPlayer: true,
        intelKnown: true,
        status: "claimed",
        zone: definition.zone,
        buildings: [building]
      }
    }),
    resolveDistrictBuildingProfile: () => localProfile
  });

  return adapter.getBuildingDetailPresentation(
    { id: 1, districtType: definition.zone },
    { buildingId },
    {
      renderState: {
        districtPanel: {
          hasPendingCommand: false,
          buildings: [{
            buildingId,
            buildingTypeId: definition.buildingTypeId,
            label: presentation.baseName,
            stats: [],
            specialActions: actions
          }],
          slots: []
        }
      }
    }
  );
}

describe("building presentation contract", () => {
  it("covers every public building type with a canonical demo identity", () => {
    for (const building of publicBuildingDefinitions) {
      expect(
        resolveBuildingPresentationDefinition(building.buildingTypeId),
        building.buildingTypeId
      ).toMatchObject({
        baseName: expect.any(String),
        mechanicsType: expect.any(String)
      });
    }
    expect(resolveBuildingPresentationDefinition("garage")).toMatchObject({
      baseName: "Garage",
      mechanicsType: "garage"
    });
    expect(resolveBuildingPresentationTypeId("Restaurace")).toBe("restaurant");
    expect(resolveBuildingPresentationTypeId("Obchodní centrum")).toBe("shopping_mall");
    expect(resolveBuildingPresentationTypeId("Autosalon")).toBe("car_dealer");
  });

  it("maps all 32 public types to the exact generated local profile identity", () => {
    expect(publicBuildingDefinitions).toHaveLength(32);
    expect(localBaseNameByBuildingTypeId.size).toBe(publicBuildingDefinitions.length);

    for (const definition of publicBuildingDefinitions) {
      const presentation = resolveBuildingPresentationDefinition(definition.buildingTypeId);
      const localBaseName = localBaseNameByBuildingTypeId.get(definition.buildingTypeId);
      const profileKey = normalizeProfileKey(presentation.baseName);

      expect(presentation.baseName, definition.buildingTypeId).toBe(localBaseName);
      expect(
        DISTRICT_BUILDING_DETAIL_PROFILES[profileKey],
        `${definition.buildingTypeId} detail profile`
      ).toBeTruthy();
      expect(
        DISTRICT_BUILDING_DETAIL_PROFILES[profileKey].actions,
        `${definition.buildingTypeId} visible action copy`
      ).toEqual(definition.specialActions.map((action) => action.label));
      expect(
        DISTRICT_BUILDING_SPECIAL_ACTION_PROFILES[profileKey] || [],
        `${definition.buildingTypeId} special action presentation rows`
      ).toHaveLength(definition.specialActions.length);
    }
  });

  it("reports the exact visible spawn-flow coverage without claiming Downtown or Casino", () => {
    const spawnReachableBuildingTypeIds = Array.from(new Set(
      empireStreetsCityMapManifest.districts
        .filter((district) => district.isSpawnCandidate)
        .flatMap((district) => resolveDistrictBuildingTypes({
          districtId: district.id,
          zone: district.zone
        }))
    )).sort();
    const browserGapTypeIds = publicBuildingDefinitions
      .map((definition) => definition.buildingTypeId)
      .filter((buildingTypeId) => !spawnReachableBuildingTypeIds.includes(buildingTypeId))
      .sort();

    expect(spawnReachableBuildingTypeIds).toHaveLength(22);
    expect(browserGapTypeIds).toEqual([
      "airport",
      "casino",
      "central_bank",
      "city_hall",
      "court",
      "lobby_club",
      "parliament",
      "port",
      "stock_exchange",
      "vip_lounge"
    ]);
  });

  it("uses one renderer schema and the canonical layout for every public type", () => {
    const schemaKeys = new Set();

    for (const definition of publicBuildingDefinitions) {
      const presentation = resolveBuildingPresentationDefinition(definition.buildingTypeId);
      const expectedLayout = definition.zone === "downtown"
        || productionBuildingTypeIds.has(definition.buildingTypeId)
        ? BUILDING_DETAIL_LAYOUTS.tabbed
        : BUILDING_DETAIL_LAYOUTS.singlePanel;
      const viewModel = pickBuildingDetailPresentationViewModel({
        buildingTypeId: definition.buildingTypeId,
        title: presentation.baseName,
        mechanicsType: presentation.mechanicsType,
        revision: 12,
        authoritativeState: { hidden: true }
      });

      expect(viewModel.layout, definition.buildingTypeId).toBe(expectedLayout);
      expect(viewModel, definition.buildingTypeId).not.toHaveProperty("revision");
      expect(viewModel, definition.buildingTypeId).not.toHaveProperty("authoritativeState");
      expect(
        Object.keys(viewModel).every((key) => BUILDING_DETAIL_VIEW_MODEL_KEYS.includes(key)),
        definition.buildingTypeId
      ).toBe(true);
      schemaKeys.add(Object.keys(viewModel).sort().join("|"));
    }

    expect(schemaKeys).toEqual(new Set([
      [
        "actions",
        "buildingTypeId",
        "collect",
        "effects",
        "layout",
        "mechanics",
        "mechanicsType",
        "stats",
        "title",
        "upgrade"
      ].join("|")
    ]));
  });

  it("keeps every authoritative adapter result inside the shared visible contract", () => {
    for (const definition of publicBuildingDefinitions) {
      const presentation = resolveBuildingPresentationDefinition(definition.buildingTypeId);
      const detail = createServerDetailForDefinition(definition);

      expect(detail, definition.buildingTypeId).toBeTruthy();
      expect(detail.baseName, definition.buildingTypeId).toBe(presentation.baseName);
      expect(detail.viewModel.mechanicsType, definition.buildingTypeId).toBe(
        presentation.mechanicsType
      );
      expect(detail.viewModel.layout, definition.buildingTypeId).toBe(
        resolveBuildingDetailLayout(presentation.mechanicsType)
      );
      expect(
        Object.keys(detail.viewModel).every((key) => BUILDING_DETAIL_VIEW_MODEL_KEYS.includes(key)),
        definition.buildingTypeId
      ).toBe(true);
      expect(detail.viewModel, definition.buildingTypeId).not.toHaveProperty("serverInstanceId");
      expect(detail.viewModel, definition.buildingTypeId).not.toHaveProperty("stateVersion");
      expect(JSON.stringify(detail.viewModel), definition.buildingTypeId).not.toContain(
        "instance:contract-matrix"
      );
      const visibleActionIds = Array.from(new Set([
        ...detail.viewModel.actions.map((action) => action.actionId),
        detail.viewModel.collect?.actionId
      ].filter(Boolean)));
      expect(visibleActionIds, definition.buildingTypeId).toEqual(
        [...definition.specialActions, ...definition.headerActions].map((action) => action.actionId)
      );
    }
  });

  it("passes only renderer-approved fields to the visible card", () => {
    const viewModel = pickBuildingDetailPresentationViewModel({
      title: "Herna",
      mechanicsType: "arcade",
      mechanics: [{ label: "Síť", value: "2" }],
      effects: [{ text: "Clean +10", tone: "positive" }],
      actions: [{
        actionId: "night_machines",
        title: "Noční automaty",
        requiresInput: [],
        serverAction: {
          description: "Spustí automaty.",
          riskSummary: ["Heat +2"],
          revision: 99
        }
      }],
      revision: 42,
      rawEffects: ["debug"],
      debugPayload: { server: true }
    });

    expect(Object.keys(viewModel).every((key) => BUILDING_DETAIL_VIEW_MODEL_KEYS.includes(key))).toBe(true);
    expect(viewModel).not.toHaveProperty("revision");
    expect(viewModel).not.toHaveProperty("rawEffects");
    expect(viewModel).not.toHaveProperty("debugPayload");
    expect(viewModel.actions[0].serverAction).toEqual({
      description: "Spustí automaty.",
      requiredInputs: [],
      riskSummary: ["Heat +2"]
    });
    expect(viewModel.layout).toBe("single-panel");
    expect(resolveBuildingDetailLayout("central-bank")).toBe("tabbed");
  });
});
