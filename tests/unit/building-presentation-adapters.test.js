import { describe, expect, it } from "vitest";
import {
  createServerBuildingActionExecutionPresentation,
  LocalDemoBuildingPresentationAdapter,
  ServerBuildingPresentationAdapter
} from "../../page-assets/js/app/runtime/buildingPresentationAdapters.js";
import { createServerDistrictActionPresentation } from "../../page-assets/js/app/runtime/serverDistrictActionPresentation.js";

const localProfile = {
  districtId: 21,
  districtLabel: "District 21",
  typeKey: "commercial",
  buildings: [
    {
      baseName: "Lékárna",
      displayName: "Pulse Pharmacy",
      imagePath: "../img/buildings/pharmacy.png"
    },
    {
      baseName: "Restaurace",
      displayName: "Neon Bite",
      imagePath: "../img/buildings/restaurant.png"
    }
  ]
};

function createServerBuildingDetail({
  baseName,
  buildingTypeId,
  displayName = baseName,
  actions = [],
  maxLevel = 1,
  passive = null,
  stats = []
}) {
  const serverBuilding = {
    buildingId: `building:district-21:${buildingTypeId}:1`,
    buildingTypeId,
    label: baseName,
    displayName,
    level: 2,
    maxLevel,
    status: "active",
    presentation: passive ? { passive } : null,
    stats,
    actions
  };
  const adapter = new ServerBuildingPresentationAdapter({
    getReadModel: () => ({
      server: {
        serverInstanceId: "instance:free:test",
        stateVersion: 7
      },
      mode: { tickRateMs: 10_000 },
      player: { playerId: "player:1", dayNight: { phaseId: "day" } },
      district: {
        districtId: "district:21",
        ownerPlayerId: "player:1",
        isOwnedByPlayer: true,
        intelKnown: true,
        status: "claimed",
        zone: "commercial",
        buildings: [serverBuilding]
      }
    }),
    resolveDistrictBuildingProfile: () => ({
      districtId: 21,
      districtLabel: "District 21",
      typeKey: "commercial",
      buildings: [{
        baseName,
        displayName,
        imagePath: `../img/buildings/${buildingTypeId}.png`
      }]
    })
  });

  return adapter.getBuildingDetailPresentation(
    { id: 21 },
    { buildingId: serverBuilding.buildingId },
    {
      renderState: {
        districtPanel: {
          hasPendingCommand: false,
          buildings: [{
            buildingId: serverBuilding.buildingId,
            buildingTypeId: serverBuilding.buildingTypeId,
            label: serverBuilding.displayName,
            stats,
            specialActions: actions.map((action) => ({
              actionId: action.actionId,
              label: action.label,
              disabled: true,
              disabledReason: "Tato speciální akce ještě není napojená na command dispatcher."
            }))
          }],
          slots: []
        }
      }
    }
  );
}

describe("shared building presentation adapters", () => {
  it("keeps local demo presentation unchanged", () => {
    const adapter = new LocalDemoBuildingPresentationAdapter({
      resolveDistrictBuildingProfile: () => localProfile
    });
    expect(adapter.getDistrictPresentation({ id: 21 }).profile).toBe(localProfile);
  });

  it("maps exact authoritative buildings into the same presentation profile", () => {
    const serverBuilding = {
      buildingId: "building:district-21:pharmacy:1",
      buildingTypeId: "pharmacy",
      label: "Lékárna",
      displayName: "Pulse Pharmacy",
      level: 3,
      status: "active"
    };
    const adapter = new ServerBuildingPresentationAdapter({
      getReadModel: () => ({
        player: { playerId: "player:1" },
        district: {
          districtId: "district:21",
          ownerPlayerId: "player:1",
          isOwnedByPlayer: true,
          intelKnown: true,
          status: "claimed",
          zone: "commercial",
          buildings: [serverBuilding]
        }
      }),
      resolveDistrictBuildingProfile: () => localProfile
    });

    const presentation = adapter.getDistrictPresentation({ id: 21 });
    expect(presentation.isOwnedByPlayer).toBe(true);
    expect(presentation.intelKnown).toBe(true);
    expect(presentation.profile.buildings[0]).toMatchObject({
      baseName: "Lékárna",
      buildingId: serverBuilding.buildingId,
      buildingTypeId: "pharmacy",
      displayName: "Pulse Pharmacy",
      imagePath: "../img/buildings/pharmacy.png",
      level: 3
    });
  });

  it("creates the shared detail view for the exact physical server building", () => {
    const firstRestaurant = {
      buildingId: "building:district-21:restaurant:1",
      buildingTypeId: "restaurant",
      label: "Restaurace",
      displayName: "Neon Bite",
      level: 2,
      status: "active"
    };
    const requestedRestaurant = {
      ...firstRestaurant,
      buildingId: "building:district-21:restaurant:2",
      displayName: "Midnight Table",
      level: 4,
      maxLevel: 5,
      actions: [{
        actionId: "restaurant_collect_revenue",
        label: "Vybrat tržby",
        description: "Vybere lokální tržby restaurace.",
        enabled: true,
        disabledReason: null,
        inputSummary: [],
        outputSummary: ["Cash +869", "Dirty cash +550"],
        riskSummary: ["Heat +5"],
        requiresInput: [],
        cooldownMs: 30 * 60 * 1000,
        cooldownRemainingMs: 42_000,
        phaseBadgeLabel: "Den"
      }]
    };
    const adapter = new ServerBuildingPresentationAdapter({
      getReadModel: () => ({
        server: {
          serverInstanceId: "instance:free:test",
          stateVersion: 7
        },
        mode: { tickRateMs: 10_000 },
        player: { playerId: "player:1", dayNight: { phaseId: "day" } },
        district: {
          districtId: "district:21",
          ownerPlayerId: "player:1",
          isOwnedByPlayer: true,
          intelKnown: true,
          status: "claimed",
          zone: "commercial",
          buildings: [firstRestaurant, requestedRestaurant]
        }
      }),
      resolveDistrictBuildingProfile: () => localProfile
    });

    const detail = adapter.getBuildingDetailPresentation(
      { id: 21 },
      { buildingId: requestedRestaurant.buildingId },
      {
        renderState: {
          districtPanel: {
          buildings: [{
              buildingId: requestedRestaurant.buildingId,
              buildingTypeId: requestedRestaurant.buildingTypeId,
              label: requestedRestaurant.displayName,
              info: "Serverový popis.",
              role: "Vliv",
              stats: [{ label: "Vliv", value: "+2" }],
              specialActions: [{
                actionId: "restaurant_collect_revenue",
                label: "Vybrat tržby",
                disabled: true,
                disabledReason: "Tato speciální akce ještě není napojená na command dispatcher."
              }]
            }],
            slots: []
          }
        }
      }
    );

    expect(detail).toMatchObject({
      serverInstanceId: "instance:free:test",
      serverDistrictId: "district:21",
      buildingId: requestedRestaurant.buildingId,
      buildingTypeId: "restaurant",
      displayName: "Neon Bite"
    });
    expect(detail.viewModel).toMatchObject({
      backgroundImagePath: "../img/buildings/restaurant.png",
      levelLabel: "L4",
      mechanicsType: "restaurant",
      meta: "",
      upgrade: {
        title: "Upgrade na L5"
      }
    });
    expect(detail.viewModel.intro).toBe(
      "Restaurace generuje prachy a funguje jako místo pro schůzky všeho druhu."
    );
    expect(detail.viewModel.mechanics).toEqual([
      {
        label: "Denní provoz",
        value: "Restaurace vydělává čisté peníze a přidává lokální vliv."
      },
      {
        label: "Pouliční drby",
        value: "Čím víc restaurací vlastníš, tím častěji se dozvíš, co se ve městě chystá."
      },
      {
        label: "Síť restaurací",
        value: "Více restaurací zvedá příjem, vliv a drby, ale taky trochu zvyšuje heat."
      }
    ]);
    expect(JSON.stringify(detail.viewModel)).not.toContain("Tato speciální akce ještě není napojená");
    expect(detail.viewModel.actions).toHaveLength(3);
    expect(detail.viewModel.actions[0]).toMatchObject({
      index: 0,
      actionId: "restaurant_collect_revenue",
      buildingTypeId: "restaurant",
      title: "Vybrat tržby",
      buttonCostLabel: "",
      cooldownLabel: "Zbývá 42s",
      cooldownRemainingMs: 42_000,
      disabled: false,
      disabledReason: "",
      phaseLockLabel: "",
      requiresInput: [],
      serverAction: {
        description: "Vybere lokální tržby restaurace.",
        riskSummary: ["Heat +5"]
      }
    });
    expect(detail.viewModel.actions[0].rewardSummary).toContain("Clean");
    expect(detail.viewModel.actions.slice(1).every((action) => action.disabled)).toBe(true);
    expect(detail.viewModel.actions[1].disabledReason).toBe("Akce teď není dostupná.");
  });

  it("keeps projected typed inputs enabled and prepares canonical confirmation copy", () => {
    const execution = createServerBuildingActionExecutionPresentation({
      action: {
        actionId: "speculative_buy",
        title: "Spekulativní nákup",
        buttonCostLabel: "$2,750 clean",
        rewardSummary: "Market tlak +1",
        cooldownLabel: "30 min",
        disabledReason: "",
        requiresInput: [
          { id: "targetCategory", label: "Kategorie marketu", required: true },
          { id: "investmentCleanCash", label: "Investice", required: true }
        ],
        serverAction: {
          description: "Nakoupí vybranou kategorii.",
          riskSummary: ["Heat +2"]
        }
      },
      context: {
        district: { id: 79 },
        serverDistrictId: "district:79",
        displayName: "Burza"
      },
      request: {
        inputs: {
          targetCategory: "electronics",
          investmentCleanCash: 2750
        }
      }
    });

    expect(execution.inputValues).toEqual({
      targetCategory: "electronics",
      investmentCleanCash: 2750
    });
    expect(execution.confirmation).toMatchObject({
      buildingLabel: "Burza",
      districtLabel: "District 79",
      inputSummary: "Kategorie marketu · Investice",
      rewardSummary: "Market tlak +1",
      disabledReason: "",
      canConfirm: true
    });
  });

  it.each([
    ["Herna", "arcade", "arcade"],
    ["Bytový blok", "apartment_block", "apartment-block"],
    ["Autosalon", "car_dealer", "auto-salon"],
    ["Obchodní centrum", "shopping_mall", "retail"],
    ["Energetická stanice", "power_station", "power-plant"],
    ["Pašerácký tunel", "smuggling_tunnel", "smuggling-tunnel"]
  ])(
    "derives %s mechanics from canonical server type %s",
    (baseName, buildingTypeId, expectedMechanicsType) => {
      const detail = createServerBuildingDetail({ baseName, buildingTypeId });

      expect(detail.baseName).toBe(baseName);
      expect(detail.buildingTypeId).toBe(buildingTypeId);
      expect(detail.viewModel.mechanicsType).toBe(expectedMechanicsType);
      expect(detail.viewModel.meta).toBe("");
      expect(JSON.stringify(detail.viewModel)).not.toContain("Server ·");
    }
  );

  it("uses numeric server presentation rates instead of rounded stat labels", () => {
    const detail = createServerBuildingDetail({
      baseName: "Herna",
      buildingTypeId: "arcade",
      passive: {
        cleanPerHour: 1_800,
        dirtyPerHour: 1_200,
        heatPerDay: 172.8,
        influencePerDay: 80
      },
      stats: [
        { label: "Clean / min", value: "$30" },
        { label: "Dirty / min", value: "$20" },
        { label: "Heat / min", value: "0.1" },
        { label: "Influence / min", value: "0.1" },
        { label: "Vlastněné herny", value: "1/16" },
        { label: "Kapacita praní", value: "$3800" },
        { label: "Audit risk", value: "3 %" }
      ]
    });

    expect(detail.viewModel.effects.map((effect) => effect.text)).toEqual(
      expect.arrayContaining([
        "Heat +172.8/den",
        "Vliv +80/den"
      ])
    );
  });

  it("lets the authoritative action override a disabled presentation placeholder", () => {
    const detail = createServerBuildingDetail({
      baseName: "Restaurace",
      buildingTypeId: "restaurant",
      actions: [{
        actionId: "restaurant_collect_revenue",
        label: "Vybrat tržby",
        description: "Vybere lokální tržby restaurace.",
        enabled: true,
        disabledReason: null,
        outputGain: { cash: 869, "dirty-cash": 550 },
        heatGain: 5,
        cooldownMs: 30 * 60 * 1000
      }]
    });

    expect(detail.viewModel.actions).toHaveLength(3);
    expect(detail.viewModel.actions[0]).toMatchObject({
      actionId: "restaurant_collect_revenue",
      disabled: false,
      disabledReason: ""
    });
    expect(detail.viewModel.actions[0].rewardSummary).toContain("Clean");
    expect(JSON.stringify(detail.viewModel)).not.toContain("restaurant-host-informant-night");
  });

  it("does not borrow a local image from an unrelated positional building", () => {
    const adapter = new ServerBuildingPresentationAdapter({
      getReadModel: () => ({
        player: { playerId: "player:1" },
        district: {
          districtId: "district:21",
          ownerPlayerId: "player:1",
          intelKnown: true,
          status: "claimed",
          zone: "commercial",
          buildings: [{
            buildingId: "building:district-21:unknown:1",
            buildingTypeId: "unknown_asset",
            label: "Neznámý asset",
            displayName: "Neznámý asset",
            level: 1,
            status: "active"
          }]
        }
      }),
      resolveDistrictBuildingProfile: () => localProfile
    });

    expect(adapter.getDistrictPresentation({ id: 21 }).profile.buildings[0].imagePath).toBeNull();
  });

  it("never falls back to local buildings for an unscoped server district", () => {
    const adapter = new ServerBuildingPresentationAdapter({
      getReadModel: () => ({ district: { districtId: "district:66", buildings: [] } }),
      resolveDistrictBuildingProfile: () => localProfile
    });
    expect(adapter.getDistrictPresentation({ id: 21 }).profile).toBeNull();
  });
});

describe("server district action presentation", () => {
  it("renders at most one action of each kind for the selected district", () => {
    const readModel = {
      district: {
        districtId: "district:21",
        attackTargets: [
          { districtId: "district:20", enabled: true, disabledReason: null }
        ],
        targetActions: {
          attackTargets: [
            { districtId: "district:21", enabled: false, disabledReason: "Ochrana cíle." }
          ],
          spyTargets: [
            { districtId: "district:21", enabled: true, disabledReason: null }
          ],
          occupyTargets: [],
          robTargets: [
            { districtId: "district:21", enabled: true, disabledReason: null }
          ],
          heistTargets: []
        },
        placeDefense: null,
        removeDefense: null,
        trap: null
      }
    };

    const actions = createServerDistrictActionPresentation(readModel, "district:21");

    expect(actions.map((action) => action.id)).toEqual(["attack", "rob", "spy"]);
    expect(actions.find((action) => action.id === "attack")).toMatchObject({
      enabled: false,
      reason: "Ochrana cíle."
    });
    expect(actions.find((action) => action.id === "rob")).toMatchObject({
      enabled: true,
      label: "Vykrást district"
    });
    expect(actions.filter((action) => action.id === "spy")).toHaveLength(1);
  });
});
