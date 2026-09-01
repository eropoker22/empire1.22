import { describe, expect, it } from "vitest";
import {
  createServerBuildingActionExecutionPresentation,
  createWarehouseStorageCompatibilityView,
  isServerBuildingCollectReady,
  LocalDemoBuildingPresentationAdapter,
  resolveSharedBuildingBackgroundImagePath,
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
  mechanics = null,
  maxLevel = 1,
  ownedCount = null,
  passive = null,
  populationBuffer = null,
  districtOwnerPlayerId = "player:1",
  isOwnedByPlayer = true,
  playerState = {},
  policeState = null,
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
    presentation: passive || ownedCount !== null || populationBuffer || mechanics
      ? {
          ...(ownedCount !== null ? { ownedCount } : {}),
          ...(passive ? { passive } : {}),
          ...(populationBuffer ? { populationBuffer } : {}),
          ...(mechanics ? { mechanics } : {})
        }
      : null,
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
      player: { playerId: "player:1", dayNight: { phaseId: "day" }, ...playerState },
      ...(policeState ? { police: policeState } : {}),
      district: {
        districtId: "district:21",
        ownerPlayerId: districtOwnerPlayerId,
        isOwnedByPlayer,
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

  it("renders a confirmed cached district without replacing it with another current district", () => {
    let currentReadModelReads = 0;
    const adapter = new ServerBuildingPresentationAdapter({
      getReadModel: () => {
        currentReadModelReads += 1;
        return {
          player: { playerId: "player:1" },
          district: { districtId: "district:66", buildings: [] }
        };
      },
      resolveDistrictBuildingProfile: () => localProfile
    });
    const confirmedReadModel = {
      player: { playerId: "player:1" },
      district: {
        districtId: "district:21",
        ownerPlayerId: "player:1",
        isOwnedByPlayer: true,
        intelKnown: true,
        status: "claimed",
        buildings: []
      }
    };

    const presentation = adapter.getDistrictPresentation(
      { id: 21 },
      { readModel: confirmedReadModel }
    );

    expect(currentReadModelReads).toBe(0);
    expect(presentation.canonicalDistrictId).toBe("district:21");
    expect(presentation.readModel.district.districtId).toBe("district:21");
  });

  it("maps a compact owned building index even when another district is currently selected", () => {
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
          buildings: []
        },
        ownedDistricts: [{
          districtId: "district:22",
          ownerPlayerId: "player:1",
          isOwnedByPlayer: true,
          intelKnown: true,
          status: "claimed",
          zone: "industrial",
          buildings: [{
            buildingId: "building:district-22:factory:1",
            buildingTypeId: "factory",
            label: "Továrna",
            displayName: "Továrna",
            level: 1,
            status: "active"
          }]
        }]
      }),
      resolveDistrictBuildingProfile: (district) => ({
        districtId: district.id,
        districtLabel: `District ${district.id}`,
        typeKey: district.id === 22 ? "industrial" : "commercial",
        buildings: [{ baseName: "Továrna", displayName: "Továrna" }]
      })
    });

    const presentation = adapter.getDistrictPresentation({ id: 22 });

    expect(presentation.isOwnedByPlayer).toBe(true);
    expect(presentation.readModel.district.districtId).toBe("district:22");
    expect(presentation.readModel.district).not.toHaveProperty("attackTargets");
    expect(presentation.readModel.district.buildings[0]).not.toHaveProperty("actions");
    expect(presentation.profile.buildings).toEqual([
      expect.objectContaining({
        buildingId: "building:district-22:factory:1",
        buildingTypeId: "factory"
      })
    ]);
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
        value: "Každých 40 minut může Restaurace zachytit městský drb."
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
    expect(detail.viewModel.actions[0].rewardSummary).toContain("Dirty cash +$550");
    expect(detail.viewModel.actions[0].rewardSummary).toContain("Čekání 30m 00s");
    expect(detail.viewModel.actions[1].rewardSummary).toContain("Trvání 30m 00s");
    expect(detail.viewModel.actions[1].rewardSummary).toContain("Čekání 45m 00s");
    expect(detail.viewModel.actions[2].rewardSummary).toContain("Čekání 30m 00s");
    expect(detail.viewModel.actions.slice(1).every((action) => action.disabled)).toBe(true);
    expect(detail.viewModel.actions[1].disabledReason).toBe("Akce teď není dostupná.");
  });

  it("keeps projected typed inputs enabled and prepares canonical confirmation copy", () => {
    const execution = createServerBuildingActionExecutionPresentation({
      action: {
        actionId: "speculative_buy",
        title: "Spekulativní nákup",
        buttonCostLabel: "$3,500 clean",
        rewardSummary: "Market tlak +1",
        cooldownLabel: "30 min",
        disabledReason: "",
        requiresInput: [
          { id: "targetCategory", label: "Kategorie marketu", required: true },
          { id: "investmentCleanCash", label: "Investice", required: true }
        ],
        serverAction: {
          description: "Nakoupí vybranou kategorii.",
          riskSummary: ["Heat +2"],
          influenceChange: 0,
          costPreview: {
            fixedInputCost: { cash: 2500 },
            variableInputCosts: [{
              inputId: "investmentCleanCash",
              resourceKey: "cash",
              amountPerUnit: 1
            }]
          }
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
      costSummary: "$5250 clean cash",
      inputSummary: "Kategorie marketu: electronics · Investice: $2750 clean cash",
      rewardSummary: "Market tlak +1",
      disabledReason: "",
      canConfirm: true
    });
  });

  it("renders authoritative input requirements and applies server-compatible defaults", () => {
    const requiredInputs = [
      {
        id: "targetCategory",
        type: "select",
        label: "Kategorie marketu",
        required: true,
        options: [{ value: "materials", label: "Materials" }]
      },
      {
        id: "investmentCleanCash",
        type: "number",
        label: "Investice",
        required: true,
        min: 1
      }
    ];
    const detail = createServerBuildingDetail({
      baseName: "Burza",
      buildingTypeId: "stock_exchange",
      actions: [{
        actionId: "speculative_buy",
        label: "Spekulativní nákup",
        enabled: true,
        requiresInput: requiredInputs
      }]
    });
    const action = detail.viewModel.actions.find(
      (candidate) => candidate.actionId === "speculative_buy"
    );

    expect(action.requiresInput).toEqual(requiredInputs);
    expect(action.serverAction.requiredInputs).toEqual(requiredInputs);

    const execution = createServerBuildingActionExecutionPresentation({
      action,
      context: {
        district: { id: 82 },
        displayName: "Burza"
      }
    });
    expect(execution.inputValues).toEqual({
      targetCategory: "materials",
      investmentCleanCash: 1000
    });
    expect(execution.confirmation.inputSummary).toContain("Kategorie marketu: Materials");
    expect(execution.confirmation.inputSummary).toContain("Investice:");
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

    const fractionalHeatDetail = createServerBuildingDetail({
      baseName: "Recyklační centrum",
      buildingTypeId: "recycling_center",
      passive: {
        cleanPerHour: 2_400,
        dirtyPerHour: 0,
        heatPerDay: 105.984,
        influencePerDay: 0
      },
      stats: [{ label: "Efekt fáze", value: "Heat 106.0/den -> 100/den" }]
    });

    expect(fractionalHeatDetail.viewModel.effects.map((effect) => effect.text)).toContain(
      "DEN: heat 105.98/den -> 100/den"
    );
  });

  it("uses authoritative owned count instead of parsing visible stat labels", () => {
    const detail = createServerBuildingDetail({
      baseName: "Herna",
      buildingTypeId: "arcade",
      ownedCount: 2,
      stats: [
        { label: "Vlastněné herny", value: "9/16" },
        { label: "Kapacita praní", value: "$3800" },
        { label: "Audit risk", value: "3 %" }
      ]
    });

    expect(detail.viewModel.countLabel).toBe("Počet: 2");
    expect(detail.viewModel.stats).toContainEqual({
      label: "Herny",
      value: "2/16"
    });
  });

  it("derives Casino audit risk from canonical authoritative police Heat", () => {
    const detail = createServerBuildingDetail({
      baseName: "Kasino",
      buildingTypeId: "casino",
      playerState: {
        heat: 0,
        policeHeat: 0,
        police: { heat: 101 }
      },
      policeState: { heat: 180 }
    });

    expect(detail.viewModel.stats).toContainEqual({
      label: "Audit risk",
      value: "18 %"
    });
  });

  it("preserves canonical zero Heat over stale legacy aliases", () => {
    const detail = createServerBuildingDetail({
      baseName: "Kasino",
      buildingTypeId: "casino",
      playerState: {
        heat: 180,
        policeHeat: 180,
        police: { heat: 0 }
      },
      policeState: { heat: 180 }
    });

    expect(detail.viewModel.stats).toContainEqual({
      label: "Audit risk",
      value: "8 %"
    });
  });

  it("maps canonical shopping mall discount labels without preserving projection signs", () => {
    const detail = createServerBuildingDetail({
      baseName: "Obchodní centrum",
      buildingTypeId: "shopping_mall",
      stats: [
        { label: "Běžný market", value: "-2 %" },
        { label: "Černý market", value: "-0.8 %" },
        { label: "Market poplatek", value: "-5 %" }
      ]
    });

    expect(detail.viewModel.stats).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Market", value: "2% běžný / 0.8% černý" }),
      expect.objectContaining({ label: "Poplatky", value: "5% nižší" })
    ]));
  });

  it("keeps canonical power station action copy while applying authoritative costs", () => {
    const detail = createServerBuildingDetail({
      baseName: "Energetická stanice",
      buildingTypeId: "power_station",
      actions: [
        {
          actionId: "backup_grid_switch",
          label: "Přepnutí na záložní síť",
          enabled: true,
          inputSummary: "3500 Cash",
          effectiveInputCost: { cash: 3500 },
          outputSummary: "Bez výstupu",
          effectiveOutputGain: {},
          cooldownMs: 60 * 60 * 1000
        },
        {
          actionId: "power_station_feed_production",
          label: "Napájet výrobu",
          enabled: true,
          inputSummary: "Zdarma",
          effectiveInputCost: {},
          outputSummary: "2000 Cash · 500 Dirty Cash",
          effectiveOutputGain: { cash: 2000, "dirty-cash": 500 },
          heatGain: 10,
          cooldownMs: 60 * 60 * 1000
        },
        {
          actionId: "power_station_reduce_heat",
          label: "Snížit heat",
          enabled: true,
          inputSummary: "10000 Cash",
          effectiveInputCost: { cash: 10000 },
          outputSummary: "Bez výstupu",
          effectiveOutputGain: {},
          heatGain: -20,
          cooldownMs: 60 * 60 * 1000
        }
      ]
    });

    expect(detail.viewModel.actions[0].buttonCostLabel).toBe("$3500 clean cash");
    expect(detail.viewModel.actions[1].buttonCostLabel).toBe("");
    expect(detail.viewModel.actions[1].rewardSummary).toContain("Clean +$2000");
    expect(detail.viewModel.actions[1].rewardSummary).not.toContain("Zdarma");
    expect(detail.viewModel.actions[2].buttonCostLabel).toBe("$10000 clean cash");
    expect(detail.viewModel.actions[2].rewardSummary).toContain("Heat -20");
  });

  it("prefers authoritative effective cost and reward on every building action", () => {
    const detail = createServerBuildingDetail({
      baseName: "Škola",
      buildingTypeId: "school",
      actions: [{
        actionId: "evening_course",
        label: "Večerní kurz",
        enabled: true,
        inputSummary: "1000 Cash",
        effectiveInputCost: { cash: 1200 },
        outputSummary: "Server: nábor +75 % na 20 minut",
        effectiveOutputGain: {},
        cooldownMs: 35 * 60 * 1000
      }]
    });
    const action = detail.viewModel.actions.find((entry) => entry.actionId === "evening_course");

    expect(action.buttonCostLabel).toBe("$1200 clean cash");
    expect(action.rewardSummary).toBe("Server: nábor +75 % na 20 minut");
    expect(action.rewardSummary).not.toContain("+60 %");
  });

  it("keeps canonical laundering mechanics visible instead of replacing them with a dynamic cash preview", () => {
    const detail = createServerBuildingDetail({
      baseName: "Herna",
      buildingTypeId: "arcade",
      actions: [{
        actionId: "back_cashdesk",
        label: "Zadní pokladna",
        enabled: true,
        inputSummary: "3800 Dirty Cash",
        effectiveInputCost: { "dirty-cash": 3800 },
        outputSummary: "3230 Cash",
        effectiveOutputGain: { cash: 3230 },
        heatGain: 3,
        influenceChange: 1,
        cooldownMs: 16 * 60 * 1000
      }]
    });
    const action = detail.viewModel.actions.find((entry) => entry.actionId === "back_cashdesk");

    expect(action.buttonCostLabel).toBe("");
    expect(action.rewardSummary).toContain("Vypere 13% dirty cash, max $3800 · fee 15%");
    expect(action.rewardSummary).toContain("Vliv +1");
    expect(action.rewardSummary).toContain("Heat +3");
    expect(action.rewardSummary).toContain("Čekání 16m 00s");
  });

  it("uses precise authoritative population buffers for apartment and convenience cards", () => {
    const apartment = createServerBuildingDetail({
      baseName: "Bytový blok",
      buildingTypeId: "apartment_block",
      populationBuffer: {
        storedAmount: 14 / 30,
        capacity: 50,
        productionPerMinute: 2,
        timeToFullMs: 1_490_000
      },
      stats: [
        { label: "Vlastněné bloky", value: "1/29" },
        { label: "Produkce bytů", value: "+0 %" },
        { label: "Kapacita bytů", value: "+0 %" }
      ]
    });
    const convenience = createServerBuildingDetail({
      baseName: "Večerka",
      buildingTypeId: "convenience_store",
      populationBuffer: {
        storedAmount: 0,
        capacity: 50,
        productionPerMinute: 50 / 60,
        timeToFullMs: 3_600_000
      },
      stats: [{ label: "Vlastněné večerky", value: "1/17" }]
    });

    expect(apartment.viewModel.mechanics).toContainEqual(expect.objectContaining({
      label: "Lokální zásobník",
      value: "0/50",
      tone: "collect-pending"
    }));
    expect(apartment.viewModel.effects.map((effect) => effect.text)).toEqual(
      expect.arrayContaining(["0/50", "Populace +2.00/min", "Naplnění za 24m 50s"])
    );
    expect(convenience.viewModel.mechanics).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Vyrobeno", value: "0/50" }),
      expect.objectContaining({ label: "Populace", value: "+50 obyv./hod" })
    ]));
    expect(convenience.viewModel.effects.map((effect) => effect.text)).toContain(
      "Populace +0.83/min"
    );
  });

  it("uses the authoritative collect control as the building readiness signal", () => {
    expect(isServerBuildingCollectReady({
      viewModel: { collect: { visible: true, enabled: true } }
    })).toBe(true);
    expect(isServerBuildingCollectReady({
      viewModel: { collect: { visible: true, enabled: false } }
    })).toBe(false);
    expect(isServerBuildingCollectReady(null)).toBe(false);
  });

  it("keeps zero population buffers disabled and school phase copy single-applied", () => {
    const apartment = createServerBuildingDetail({
      baseName: "Bytový blok",
      buildingTypeId: "apartment_block",
      populationBuffer: {
        storedAmount: 0,
        capacity: 50,
        productionPerMinute: 2,
        timeToFullMs: 1_500_000
      },
      actions: [{
        actionId: "collect_population",
        label: "Vybrat obyvatele",
        enabled: false,
        disabledReason: "Bytový blok zatím nemá připravené obyvatele."
      }]
    });
    const convenience = createServerBuildingDetail({
      baseName: "Večerka",
      buildingTypeId: "convenience_store",
      populationBuffer: {
        storedAmount: 0,
        capacity: 50,
        productionPerMinute: 50 / 60,
        timeToFullMs: 3_600_000
      },
      actions: [{
        actionId: "collect_convenience_store_population",
        label: "Vybrat obyvatele",
        enabled: false,
        disabledReason: "Večerka zatím nemá připravené obyvatele."
      }]
    });
    const school = createServerBuildingDetail({
      baseName: "Škola",
      buildingTypeId: "school",
      populationBuffer: {
        storedAmount: 0,
        capacity: 20,
        productionPerMinute: 0.55,
        timeToFullMs: 1_820_000
      },
      stats: [
        { label: "Vlastněné školy", value: "1/6" },
        { label: "Produkce populace", value: "+0 %" },
        { label: "Kapacita", value: "+0 %" },
        { label: "Income", value: "+0 %" }
      ],
      actions: [{
        actionId: "collect_school_population",
        label: "Vybrat obyvatele",
        enabled: false,
        disabledReason: "Škola zatím nemá připravené členy k výběru."
      }]
    });

    expect(apartment.viewModel.collect).toMatchObject({
      visible: true,
      enabled: false,
      actionId: "collect_population",
      buildingTypeId: "apartment_block",
      action: {
        actionId: "collect_population",
        buildingTypeId: "apartment_block",
        disabledReason: "Bytový blok zatím nemá připravené obyvatele.",
        serverAction: {
          description: "",
          requiredInputs: [],
          riskSummary: []
        }
      }
    });
    expect(convenience.viewModel.collect).toMatchObject({
      visible: true,
      enabled: false,
      actionId: "collect_convenience_store_population",
      buildingTypeId: "convenience_store",
      action: {
        actionId: "collect_convenience_store_population",
        buildingTypeId: "convenience_store"
      }
    });
    expect(school.viewModel.collect).toMatchObject({
      visible: true,
      enabled: false,
      actionId: "collect_school_population",
      title: "Škola zatím nemá připravené členy k výběru."
    });
    expect(school.viewModel.actions.map((action) => action.actionId)).not.toContain("collect_school_population");
    expect(school.viewModel.mechanics).toContainEqual(expect.objectContaining({
      label: "Produkce",
      value: "+0.55 populace/min"
    }));
    expect(school.viewModel.effects).toContainEqual(expect.objectContaining({
      text: "DEN: populace 0.55/min -> 0.66/min"
    }));

    const readySchool = createServerBuildingDetail({
      baseName: "Škola",
      buildingTypeId: "school",
      populationBuffer: {
        storedAmount: 4.8,
        capacity: 20,
        productionPerMinute: 0.55,
        timeToFullMs: 1_380_000
      },
      actions: [{
        actionId: "collect_school_population",
        label: "Vybrat obyvatele",
        enabled: true,
        disabledReason: null
      }]
    });

    expect(readySchool.viewModel.collect).toMatchObject({
      visible: true,
      enabled: true,
      actionId: "collect_school_population",
      action: {
        actionId: "collect_school_population",
        buildingTypeId: "school",
        disabled: false,
        disabledReason: ""
      },
      title: "Vybrat připravený výstup: 4/20 členů"
    });
    expect(readySchool.viewModel.actions.map((action) => action.actionId)).not.toContain("collect_school_population");
  });

  it("maps recruitment and car dealer support from their canonical stat labels", () => {
    const recruitment = createServerBuildingDetail({
      baseName: "Rekrutační centrum",
      buildingTypeId: "recruitment_center",
      stats: [
        { label: "Produkce bytů", value: "+3 %" },
        { label: "Kapacita bytů", value: "+4 %" },
        { label: "Síla útočných zbraní", value: "+2 %" },
        { label: "Síla obranných itemů", value: "+1.5 %" },
        { label: "Kamery/alarmy", value: "+1.5 %" },
        { label: "Cap kamer/alarmu", value: "max +50 %" }
      ]
    });
    const carDealer = createServerBuildingDetail({
      baseName: "Autosalon",
      buildingTypeId: "car_dealer",
      stats: [
        { label: "Zkrácení čekání", value: "-1.5 %" },
        { label: "Šance úniku", value: "+2 %" },
        { label: "Cap garáž + autosalon", value: "-20 %" }
      ]
    });

    expect(recruitment.viewModel.effects.map((effect) => effect.text)).toContain(
      "Kamery/alarmy +1.5 %"
    );
    expect(carDealer.viewModel.mechanics.map((row) => `${row.label}${row.value}`)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("o 1.5%."),
        expect.stringContaining("přidá +2%")
      ])
    );
  });

  it("maps recycling and smuggling support from authoritative stat labels", () => {
    const recyclingCenter = createServerBuildingDetail({
      baseName: "Recyklační centrum",
      buildingTypeId: "recycling_center",
      ownedCount: 1,
      playerState: { economy: { cleanCash: 5_000 } },
      stats: [
        { label: "Návrat itemů", value: "12 %" },
        { label: "Síťový income", value: "+4 %" }
      ],
      actions: [{
        actionId: "extract_losses",
        label: "Vytěžit ztráty",
        enabled: false,
        disabledReason: "Nemáš žádné itemové ztráty k vytěžení.",
        effectiveInputCost: { cash: 900 },
        cooldownMs: 16 * 60 * 1000
      }]
    });
    const smugglingTunnel = createServerBuildingDetail({
      baseName: "Pašovací tunel",
      buildingTypeId: "smuggling_tunnel",
      ownedCount: 1,
      stats: [
        { label: "Podpora Pouličních dealerů", value: "+4 %" },
        { label: "Dirty bonus sítě", value: "+5 %" },
        { label: "Heat bonus sítě", value: "+3 %" }
      ]
    });

    expect(recyclingCenter.viewModel.mechanics).toContainEqual(expect.objectContaining({
      label: "Vytěžit ztráty",
      value: "Vrátí 12 % čerstvých itemových ztrát."
    }));
    expect(recyclingCenter.viewModel.mechanics).toContainEqual(expect.objectContaining({
      label: "Síť center",
      value: "clean +4 %"
    }));
    expect(recyclingCenter.viewModel.actions[0].disabledReason).toBe(
      "Nemáš žádné ztráty k vytěžení."
    );
    expect(smugglingTunnel.viewModel.effects.map((effect) => effect.text)).toContain(
      "Pouliční dealeři +4% z pašovacích tunelů"
    );
    expect(smugglingTunnel.viewModel.mechanics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: "Pouliční dealeři",
        value: "Prodej z Labu: rychlost +1.4% · cena zůstává pevná."
      }),
      expect.objectContaining({
        label: "Pouliční riziko",
        value: "Riziko při prodeji -1.6% · heat z prodeje +0.8%."
      })
    ]));
    expect(smugglingTunnel.viewModel.stats).toContainEqual({
      label: "Síť",
      value: "dirty tok +5 % · heat +3 %"
    });
  });

  it("maps garage and fitness values from their canonical projection labels", () => {
    const garage = createServerBuildingDetail({
      baseName: "Garáž",
      buildingTypeId: "garage",
      ownedCount: 1,
      stats: [{ label: "Zkrácení čekání", value: "-2 %" }]
    });
    const fitnessClub = createServerBuildingDetail({
      baseName: "Fitness club",
      buildingTypeId: "fitness_club",
      ownedCount: 1,
      stats: [
        { label: "Síla útoku", value: "+3 %" },
        { label: "Síla obrany", value: "+2 %" },
        { label: "Cap útoku", value: "+24 %" },
        { label: "Cap obrany", value: "+18 %" }
      ]
    });

    expect(garage.viewModel.stats).toContainEqual({ label: "Cooldowny", value: "-2%" });
    expect(garage.viewModel.effects.map((effect) => effect.text)).toContain("Cooldowny -2%");
    expect(fitnessClub.viewModel.stats).toEqual(expect.arrayContaining([
      { label: "Útok", value: "+3%" },
      { label: "Obrana", value: "+2%" },
      { label: "Cap s rekrutací", value: "+24% / +18%" }
    ]));
  });

  it("derives local and hosted warehouse warnings from the same storage summary", () => {
    const warehouseStorage = createWarehouseStorageCompatibilityView({
      warehouseSummary: {
        ownedWarehouseCount: 1,
        highestWarehouseLevel: 1,
        warehouseCountMultiplier: 1.5,
        warehouseLevelMultiplier: 1,
        totalCapacityMultiplier: 1.5
      },
      groups: [{
        id: "strategic",
        label: "Strategické zásoby",
        baseCapacity: 8,
        currentCapacity: 12,
        items: [{
          resourceKey: "smg",
          label: "Samopal",
          currentAmount: 200,
          maxAmount: 12,
          fillPercent: 1_666.67,
          isNearCapacity: false,
          isFull: false,
          isOverCapacity: true
        }]
      }]
    });

    expect(warehouseStorage.capacity?.strategic).toBe(12);
    expect(warehouseStorage.usage?.byResource.smg).toBe(200);
    expect(warehouseStorage.warnings).toEqual([
      "Některá položka v globálním SKLADU je plná.",
      "Získej další Skladiště nebo spotřebuj konkrétní položku."
    ]);
  });

  it("uses typed clinic and exchange mechanics while preserving explicit zero values", () => {
    const clinic = createServerBuildingDetail({
      baseName: "Klinika",
      buildingTypeId: "clinic",
      ownedCount: 1,
      mechanics: {
        clinic: {
          recoveryRatePct: 15,
          recoveryPool: {
            totalFreshAmount: 7,
            fresh: [{ id: "recovery:1", itemType: "population", amount: 7, source: "attack" }]
          },
          network: { incomeMultiplier: 1, heatMultiplier: 1 }
        }
      }
    });
    const emptyClinic = createServerBuildingDetail({
      baseName: "Klinika",
      buildingTypeId: "clinic",
      ownedCount: 1,
      playerState: { economy: { cleanCash: 5_000 } },
      actions: [{
        actionId: "stabilization_protocol",
        label: "Stabilizační protokol",
        enabled: false,
        disabledReason: "Žádné ztráty k léčbě.",
        effectiveInputCost: { cash: 1_200 },
        cooldownMs: 18 * 60 * 1_000
      }],
      mechanics: {
        clinic: {
          recoveryRatePct: 0,
          recoveryPool: { totalFreshAmount: 0, fresh: [] },
          network: { incomeMultiplier: 1, heatMultiplier: 1 }
        }
      }
    });
    const exchange = createServerBuildingDetail({
      baseName: "Směnárna",
      buildingTypeId: "exchange",
      ownedCount: 1,
      mechanics: {
        exchange: {
          launderingCapacity: 6_000,
          auditRiskPct: 4,
          network: { incomeMultiplier: 1, launderingLimitMultiplier: 1, heatMultiplier: 1 }
        }
      }
    });

    expect(clinic.viewModel.stats).toEqual(expect.arrayContaining([
      { label: "Recovery rate", value: "15 %" },
      { label: "Recovery pool", value: "7 položek" }
    ]));
    expect(emptyClinic.viewModel.stats).toEqual(expect.arrayContaining([
      { label: "Recovery rate", value: "0 %" },
      { label: "Recovery pool", value: "0 položek" }
    ]));
    expect(emptyClinic.viewModel.actions[0]).toMatchObject({
      disabled: true,
      disabledReason: "Žádné ztráty k léčbě.",
      description: "Žádné ztráty k léčbě."
    });
    expect(exchange.viewModel.stats).toEqual(expect.arrayContaining([
      { label: "Kapacita praní", value: "$6000" },
      { label: "Audit risk", value: "4 %" }
    ]));
  });

  it("maps authoritative player storage into the shared warehouse summary", () => {
    const storage = {
      warehouseSummary: {
        ownedWarehouseCount: 2,
        highestWarehouseLevel: 2,
        warehouseCountMultiplier: 1.6,
        warehouseLevelMultiplier: 1.12,
        totalCapacityMultiplier: 1.792
      },
      groups: [{
        id: "bulk",
        label: "Hromadné zásoby",
        baseCapacity: 60,
        currentCapacity: 108,
        items: [{
          resourceKey: "chemicals",
          label: "Chemicals",
          currentAmount: 0,
          maxAmount: 108,
          fillPercent: 0,
          isNearCapacity: false,
          isFull: false,
          isOverCapacity: false
        }]
      }],
      pendingDeliveries: []
    };
    const warehouse = createServerBuildingDetail({
      baseName: "Skladiště",
      buildingTypeId: "warehouse",
      ownedCount: 9,
      playerState: { storage },
      mechanics: {
        warehouse: {
          network: { incomeMultiplier: 1.04, storageCapacityMultiplier: 1.6, heatMultiplier: 1.03 }
        }
      }
    });

    expect(warehouse.viewModel.countLabel).toBe("Počet: 2");
    expect(warehouse.viewModel.stats).toEqual(expect.arrayContaining([
      { label: "Síť skladišť", value: "2" },
      { label: "Celková kapacita", value: "kapacita +79 %" },
      { label: "Hromadné zásoby", value: "+48 ks ze skladišť · celkem 108 ks" }
    ]));
    expect(warehouse.viewModel.mechanics).toEqual([
      { label: "Hromadné zásoby", value: "Bonus tvých skladišť: +48 ks · celkem 108 ks na položku" },
      { label: "Taktické zásoby", value: "Základní kapacita: 24 ks na položku" },
      { label: "Strategické zásoby", value: "Základní kapacita: 8 ks na položku" }
    ]);
    expect(warehouse.viewModel.effects.map((effect) => effect.text)).toContain(
      "Síť skladišť zvyšuje Income +4 %, kapacitu +79 % i Heat +3 %."
    );
    expect(warehouse.viewModel.effects.map((effect) => effect.text)).not.toContain(
      "Některá položka v globálním SKLADU je plná."
    );
  });

  it("does not mix viewer storage into a foreign warehouse without projected mechanics", () => {
    const viewerStorage = {
      warehouseSummary: {
        ownedWarehouseCount: 7,
        highestWarehouseLevel: 4,
        warehouseCountMultiplier: 1.9,
        warehouseLevelMultiplier: 1.4,
        totalCapacityMultiplier: 2.66
      },
      groups: [{
        id: "bulk",
        label: "Hromadné zásoby",
        baseCapacity: 60,
        currentCapacity: 160,
        items: [{
          resourceKey: "chemicals",
          label: "Chemicals",
          currentAmount: 160,
          maxAmount: 160,
          fillPercent: 100,
          isNearCapacity: true,
          isFull: true,
          isOverCapacity: false
        }]
      }],
      pendingDeliveries: []
    };
    const warehouse = createServerBuildingDetail({
      baseName: "Skladiště",
      buildingTypeId: "warehouse",
      districtOwnerPlayerId: "player:2",
      isOwnedByPlayer: false,
      ownedCount: 3,
      playerState: { storage: viewerStorage }
    });

    expect(warehouse.viewModel.stats).not.toContainEqual({ label: "Síť skladišť", value: "7" });
    expect(warehouse.viewModel.stats).not.toContainEqual({ label: "Celkový násobitel", value: "x2.66" });
    expect(warehouse.viewModel.stats).not.toContainEqual({
      label: "Hromadné zásoby",
      value: "160 ks na položku"
    });
    expect(warehouse.viewModel.effects.map((effect) => effect.text)).not.toContain(
      "Některá položka v globálním SKLADU je plná."
    );
  });

  it("preserves the authoritative street dealer sale view for shared controls", () => {
    const dealerSale = {
      phase: "day",
      phaseStatusLabel: "DEN: heat +30 %, riziko +10 p. b.",
      slotCount: 3,
      slots: [{
        slotId: "slot-1",
        label: "Neon Dust",
        itemId: "neon-dust",
        itemLabel: "Neon Dust",
        ownedAmount: 60,
        unitSalePriceDirtyCash: 625,
        minimumAmountPerSale: 10,
        locked: false,
        statusLabel: ""
      }],
      items: [{
        itemId: "neon-dust",
        label: "Neon Dust",
        ownedAmount: 60,
        unitSalePriceDirtyCash: 625,
        minimumAmountPerSale: 10
      }]
    };
    const detail = createServerBuildingDetail({
      baseName: "Pouliční dealeři",
      buildingTypeId: "street_dealers",
      actions: [{
        actionId: "start_drug_sale",
        label: "Spustit prodej",
        enabled: true,
        disabledReason: null,
        dealerSale
      }]
    });
    const action = detail.viewModel.actions.find(
      (candidate) => candidate.actionId === "start_drug_sale"
    );

    expect(action?.dealerSale).toEqual(dealerSale);
    expect(action?.dealerSale?.slots[0]).toMatchObject({
      ownedAmount: 60,
      unitSalePriceDirtyCash: 625,
      minimumAmountPerSale: 10
    });
  });

  it("prefers the canonical shared background over an adapter fallback", () => {
    expect(resolveSharedBuildingBackgroundImagePath({
      canonicalBackgroundImagePath: "../img/dizajn/BUILDINGS/ARCADE/arcade-03.png",
      presentationBackgroundImagePath: "../img/buildings/arcade.png"
    })).toBe("../img/dizajn/BUILDINGS/ARCADE/arcade-03.png");
    expect(resolveSharedBuildingBackgroundImagePath({
      presentationBackgroundImagePath: "../img/buildings/unknown.png"
    })).toBe("../img/buildings/unknown.png");
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
      reason: "",
      stacked: true,
      subtitle: "Ochrana cíle.",
      disabledTone: "unavailable"
    });
    expect(actions.find((action) => action.id === "rob")).toMatchObject({
      enabled: true,
      label: "Vykrást district"
    });
    expect(actions.filter((action) => action.id === "spy")).toHaveLength(1);
  });

  it("keeps hosted trap stacked while target actions match the demo button presentation", () => {
    const actions = createServerDistrictActionPresentation({
      district: {
        districtId: "district:21",
        targetActions: {
          attackTargets: [],
          spyTargets: [{
            districtId: "district:21",
            name: "District 21",
            enabled: true,
            disabledReason: null
          }],
          occupyTargets: [],
          robTargets: [],
          heistTargets: []
        },
        placeDefense: null,
        removeDefense: null,
        trap: {
          enabled: true,
          disabledReason: null,
          activeTrap: null,
          relocationCooldownRemainingTicks: 0,
          relocationSource: null
        }
      }
    }, "district:21");

    expect(actions.find((action) => action.id === "trap")).toMatchObject({
      stacked: true,
      title: "Nastraž 1 past do svého districtu.",
      trapState: "idle"
    });
    expect(actions.find((action) => action.id === "spy")).toMatchObject({
      stacked: false,
      subtitle: ""
    });
  });

  it("shows the exact server-recommended heist payload before one-click launch", () => {
    const actions = createServerDistrictActionPresentation({
      district: {
        districtId: "district:21",
        targetActions: {
          attackTargets: [],
          spyTargets: [],
          occupyTargets: [],
          robTargets: [],
          heistTargets: [{
            districtId: "district:21",
            enabled: true,
            recommendedStyle: "balanced",
            styles: [{
              style: "balanced",
              label: "Vyvážený",
              enabled: true,
              defaultPopulationSent: 10
            }]
          }]
        }
      }
    }, "district:21");

    expect(actions[0]).toMatchObject({
      id: "heist",
      enabled: true,
      stacked: true,
      subtitle: "Vyvážený · 10 lidí · verdikt po odpočtu",
      title: "Kliknutí okamžitě vyšle Vyvážený · 10 lidí · verdikt po odpočtu."
    });
  });

  it("uses a concise hosted no-spies reason inside the disabled action", () => {
    const actions = createServerDistrictActionPresentation({
      district: {
        districtId: "district:21",
        targetActions: {
          attackTargets: [],
          heistTargets: [],
          occupyTargets: [],
          robTargets: [],
          spyTargets: [{
            districtId: "district:21",
            enabled: false,
            disabledCode: "SPY_SLOT_LIMIT_REACHED",
            disabledReason: "Hráč už má 2 aktivní nebo blokované špehy."
          }]
        }
      }
    }, "district:21");

    expect(actions[0]).toMatchObject({
      id: "spy",
      enabled: false,
      stacked: true,
      subtitle: "Žádní špehové",
      disabledTone: "no-spies"
    });
  });
});
