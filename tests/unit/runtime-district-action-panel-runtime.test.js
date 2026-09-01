import { describe, expect, it, vi } from "vitest";
import {
  createAuthoritativeDefenseSetupState,
  createDistrictActionPanelRuntime,
  createServerDefenseAdjustment
} from "../../page-assets/js/app/runtime/districtActionPanelRuntime.js";

function input(value = "0", dataset = {}) {
  return { value, max: "0", disabled: false, dataset };
}

function textElement(textContent = "") {
  return {
    textContent,
    disabled: false,
    dataset: {},
    classList: { remove: vi.fn() }
  };
}

describe("district action panel runtime", () => {
  it("renders attack summary and stores pending attack context outside runtime", () => {
    const attackSourceSelect = { value: "2", replaceChildren: vi.fn(), append: vi.fn(), disabled: false };
    const attackConfirmButton = textElement();
    const attackRequiredPopulation = textElement();
    const attackEstimatedPower = textElement();
    const attackStatus = textElement();
    const runtime = createDistrictActionPanelRuntime({
      attackCooldownMs: 10000,
      attackSetupWeapons: { pistol: true },
      attackWeaponLabels: { pistol: "Pistole" },
      calculateAttackDeployment: () => ({ totalResidents: 3, totalPower: 12 }),
      estimateDistrictDefense: () => 8,
      getDistrictOwnerLabel: () => "Enemy",
      getPlayerAttackBoostContext: ({ attackPower, defensePower }) => ({
        effectiveAttackPower: attackPower,
        effectiveDefensePower: defensePower,
        cooldownMs: 10000
      }),
      getResolvedWorldState: () => ({ districtDefenseById: {}, districtTrapById: {} }),
      renderAttackProgress: vi.fn((payload, options) => {
        options.elements.requiredPopulation.textContent = String(payload.totalResidents);
        options.elements.estimatedPower.textContent = String(payload.totalPower);
        options.elements.status.textContent = payload.status;
        options.elements.confirmButton.disabled = !payload.canConfirm;
      }),
      resolveAttackOutcome: () => ({ label: "Výhra" }),
      validateAttackSelection: () => ({ canConfirm: true, status: "Připraveno" }),
      elements: {
        attackSourceSelect,
        attackConfirmButton,
        attackRequiredPopulation,
        attackEstimatedPower,
        attackStatus,
        attackWeaponInputs: [input("2", { attackWeaponInput: "pistol" })],
        populationValue: textElement("12")
      }
    });

    const summary = runtime.renderAttackSummary();
    const context = runtime.getPreparedAttackContext({ id: 9, districtType: "industrial" });
    runtime.setPendingAttackContext(context);

    expect(summary).toEqual({
      totalResidents: 3,
      totalPower: 12,
      canConfirm: true,
      bonusPowerLabel: "",
      powerLabel: "12"
    });
    expect(attackRequiredPopulation.textContent).toBe("3");
    expect(context.selectedWeaponsLabel).toBe("Pistole x2");
    expect(runtime.getPendingAttackContext()).toBe(context);

    runtime.clearPendingAttackContext();
    expect(runtime.getPendingAttackContext()).toBe(null);
  });

  it("never presents a random local attack outcome in authoritative gameplay", () => {
    const resolveAttackOutcome = vi.fn(() => ({ label: "Náhodná lokální výhra" }));
    const estimateDistrictDefense = vi.fn(() => 999);
    const runtime = createDistrictActionPanelRuntime({
      attackSetupWeapons: { pistol: true },
      attackWeaponLabels: { pistol: "Pistole" },
      calculateAttackDeployment: () => ({ totalResidents: 2, totalPower: 10 }),
      estimateDistrictDefense,
      getPlayerAttackBoostContext: ({ attackPower, defensePower }) => ({
        effectiveAttackPower: attackPower,
        effectiveDefensePower: defensePower,
        cooldownMs: 10_000
      }),
      getResolvedWorldState: () => ({ districtDefenseById: {}, districtTrapById: {} }),
      isServerAuthoritativeGameplayRuntimeReady: () => true,
      renderAttackProgress: vi.fn(),
      resolveAttackOutcome,
      validateAttackSelection: () => ({ canConfirm: true, status: "Připraveno" }),
      elements: {
        attackSourceSelect: { value: "2", replaceChildren: vi.fn(), append: vi.fn(), disabled: false },
        attackConfirmButton: textElement(),
        attackRequiredPopulation: textElement(),
        attackEstimatedPower: textElement(),
        attackStatus: textElement(),
        attackWeaponInputs: [input("2", { attackWeaponInput: "pistol" })],
        populationValue: textElement("12")
      }
    });

    const context = runtime.getPreparedAttackContext({ id: 9, districtType: "industrial" });

    expect(context.authoritative).toBe(true);
    expect(context.resolvedScenario).toBe(null);
    expect(resolveAttackOutcome).not.toHaveBeenCalled();
    expect(estimateDistrictDefense).not.toHaveBeenCalled();
  });

  it("builds the first authoritative defense placement without a remove view", () => {
    const placeView = {
      expectedTargetVersion: 7,
      availableInventoryAmounts: { vest: 3, cameras: 0 },
      ownerOwnedAmounts: { vest: 0, cameras: 1 },
      alliedContributionAmounts: { vest: 0, cameras: 2 },
      playerRemovableAmounts: { vest: 0, cameras: 0 }
    };

    expect(createServerDefenseAdjustment({
      placeView,
      removeView: null,
      defenseItemId: "vest",
      desiredTotalAmount: 2
    })).toEqual({
      delta: 2,
      command: {
        type: "place-defense",
        defenseItemId: "vest",
        amount: 2,
        expectedTargetVersion: 7
      }
    });
    expect(createAuthoritativeDefenseSetupState(placeView)).toEqual({
      weaponInventory: { vest: 3, cameras: 0 },
      currentDefense: {
        loadout: { cameras: 3 },
        residents: 0
      }
    });
  });

  it("keeps owner and other ally defense locked when an ally changes their contribution", () => {
    const placeView = {
      expectedTargetVersion: 11,
      ownerOwnedAmounts: { vest: 3 },
      alliedContributionAmounts: { vest: 4 },
      playerRemovableAmounts: { vest: 1 }
    };

    expect(createServerDefenseAdjustment({
      placeView,
      defenseItemId: "vest",
      desiredTotalAmount: 8
    })).toEqual({
      delta: 1,
      command: {
        type: "place-defense",
        defenseItemId: "vest",
        amount: 1,
        expectedTargetVersion: 11
      }
    });
    expect(createServerDefenseAdjustment({
      placeView,
      defenseItemId: "vest",
      desiredTotalAmount: 6
    })).toEqual({
      delta: -1,
      command: {
        type: "remove-defense",
        defenseItemId: "vest",
        amount: 1,
        expectedTargetVersion: 11
      }
    });
  });

  it("uses only the server defense item loadout for authoritative strength", () => {
    const residentsRow = { hidden: false };
    const defenseResidentsInput = {
      ...input("50"),
      closest: vi.fn(() => residentsRow)
    };
    const defenseWeaponInput = input("0", { defenseWeaponInput: "vest" });
    const calculateTotalDefensePower = vi.fn(({ loadout }) => ({ totalPower: Number(loadout.vest || 0) * 6 }));
    const getResolvedWeaponInventory = vi.fn(() => ({ vest: 99 }));
    const getDistrictDefenseState = vi.fn(() => ({ loadout: { vest: 99 }, residents: 99 }));
    const runtime = createDistrictActionPanelRuntime({
      calculateTotalDefensePower,
      getAuthoritativeDefenseView: () => ({
        availableInventoryAmounts: { vest: 2 },
        ownerOwnedAmounts: { vest: 1 },
        alliedContributionAmounts: { vest: 1 },
        playerRemovableAmounts: { vest: 1 }
      }),
      getDistrictAtmosphereMeta: () => ({}),
      getDistrictDefenseState,
      getInteractionState: () => ({}),
      getResolvedWeaponInventory,
      isServerAuthoritativeGameplayRuntimeReady: () => true,
      elements: {
        defenseSetupPopup: textElement(),
        defenseTargetTitle: textElement(),
        defenseWeaponInputs: [defenseWeaponInput],
        defenseOwnedElements: [],
        defenseResidentsInput,
        defenseEstimatedPower: textElement(),
        defenseStatus: textElement(),
        defenseConfirmButton: textElement()
      }
    });

    runtime.populateDefenseSetupPopup({ id: 9 });

    expect(defenseWeaponInput.value).toBe("2");
    expect(defenseWeaponInput.max).toBe("4");
    expect(calculateTotalDefensePower).toHaveBeenCalledWith({ loadout: { vest: 2 } });
    expect(defenseResidentsInput.value).toBe("0");
    expect(defenseResidentsInput.disabled).toBe(true);
    expect(residentsRow.hidden).toBe(true);
    expect(getResolvedWeaponInventory).not.toHaveBeenCalled();
    expect(getDistrictDefenseState).not.toHaveBeenCalled();
  });

  it("shows recruitment strength bonus in attack and defense power labels", () => {
    const attackEstimatedPower = textElement();
    const attackStatus = textElement();
    const attackConfirmButton = textElement();
    const defenseEstimatedPower = textElement();
    const defenseStatus = textElement();
    const defenseConfirmButton = textElement();
    const runtime = createDistrictActionPanelRuntime({
      attackSetupWeapons: { pistol: true },
      attackWeaponLabels: { pistol: "Pistole" },
      calculateAttackDeployment: () => ({
        totalResidents: 2,
        totalPower: 21.6,
        basePower: 20,
        bonusPower: 1.6,
        bonusPowerLabel: "+1.6"
      }),
      calculateTotalDefensePower: () => ({
        totalPower: 12.9,
        basePower: 12,
        bonusPower: 0.9,
        bonusPowerLabel: "+0.9"
      }),
      renderAttackProgress: vi.fn((payload, options) => {
        options.elements.estimatedPower.textContent = payload.powerLabel;
        options.elements.status.textContent = payload.status;
        options.elements.confirmButton.disabled = !payload.canConfirm;
      }),
      validateAttackSelection: () => ({ canConfirm: true, status: "Připraveno" }),
      elements: {
        attackSourceSelect: { value: "2", replaceChildren: vi.fn(), append: vi.fn(), disabled: false },
        attackRequiredPopulation: textElement(),
        attackEstimatedPower,
        attackStatus,
        attackConfirmButton,
        attackWeaponInputs: [input("2", { attackWeaponInput: "pistol" })],
        defenseWeaponInputs: [input("1", { defenseWeaponInput: "vest" })],
        defenseResidentsInput: input("0"),
        defenseEstimatedPower,
        defenseStatus,
        defenseConfirmButton,
        populationValue: textElement("12")
      }
    });

    const attackSummary = runtime.renderAttackSummary();
    const defenseSummary = runtime.renderDefenseSummary();

    expect(attackSummary.powerLabel).toBe("21.6 (+1.6)");
    expect(attackEstimatedPower.textContent).toBe("21.6 (+1.6)");
    expect(defenseSummary.powerLabel).toBe("12.9 (+0.9)");
    expect(defenseEstimatedPower.textContent).toBe("12.9 (+0.9)");
  });

  it("handles missing panel DOM without crashing", () => {
    const runtime = createDistrictActionPanelRuntime({});

    expect(runtime.renderAttackSummary()).toEqual({ totalResidents: 0, totalPower: 0, canConfirm: false });
    expect(runtime.renderRobberySummary()).toEqual({ deployedMembers: 0, canConfirm: false });
    expect(runtime.renderDefenseSummary()).toEqual({ residents: 0, totalPower: 0, canConfirm: false });
    expect(() => runtime.populateTrapConfirmPopup({ id: 1 })).not.toThrow();
    expect(() => runtime.populateSpyConfirmPopup({ id: 1 })).not.toThrow();
  });

  it("renders spy confirmation without source row and keeps unknown target atmosphere hidden", () => {
    const spyConfirmAtmosphereImage = { src: "", alt: "", dataset: {} };
    const spyConfirmAtmosphereLabel = textElement();
    const getDistrictAtmosphereMeta = vi.fn((district, interactionState = {}) => ({
      typeKey: "unknown",
      label: "Skrytý sektor",
      imagePath: "../img/blackout.png",
      interactionState
    }));
    const runtime = createDistrictActionPanelRuntime({
      getAdjacentDistrictIdsFromGeometry: () => [1],
      getCurrentPlayerOwnedDistrictIds: () => new Set([1]),
      getDistrictAtmosphereMeta,
      getGeometry: () => ({}),
      getInteractionState: () => ({ revealedTypeDistrictIds: [] }),
      getResolvedSpyState: () => ({ available: 2 }),
      spyCooldownMs: 16000,
      elements: {
        spyConfirmPopup: textElement(),
        spyConfirmCard: textElement(),
        spyConfirmAtmosphereImage,
        spyConfirmAtmosphereLabel,
        spyConfirmTitle: textElement(),
        spyConfirmAvailable: textElement(),
        spyConfirmDuration: textElement(),
        spyConfirmNote: textElement(),
        spyConfirmButton: textElement()
      }
    });

    runtime.populateSpyConfirmPopup({ id: 7, districtType: "park" });

    expect(getDistrictAtmosphereMeta).toHaveBeenCalledWith(
      expect.objectContaining({ id: 7, districtType: "park" }),
      expect.not.objectContaining({ forceRevealAtmosphere: true })
    );
    expect(spyConfirmAtmosphereImage.src).toBe("../img/blackout.png");
    expect(spyConfirmAtmosphereLabel.textContent).toBe("");
  });

  it("marks a blocked attack as an error and keeps canonical robbery ready with one free member", () => {
    const attackStatus = textElement();
    const attackConfirmButton = textElement();
    const runtime = createDistrictActionPanelRuntime({
      attackSetupWeapons: { pistol: true },
      calculateAttackDeployment: () => ({ totalResidents: 0, totalPower: 0 }),
      renderAttackProgress: vi.fn((payload, options) => {
        options.elements.status.textContent = payload.status;
        options.elements.confirmButton.disabled = !payload.canConfirm;
      }),
      validateAttackSelection: () => ({ canConfirm: false, status: "Vyber zbraně" }),
      elements: {
        attackSourceSelect: { value: "2", replaceChildren: vi.fn(), append: vi.fn(), disabled: false },
        attackRequiredPopulation: textElement(),
        attackEstimatedPower: textElement(),
        attackStatus,
        attackConfirmButton,
        attackWeaponInputs: [input("0", { attackWeaponInput: "pistol" })],
        populationValue: textElement("12")
      }
    });

    const attackSummary = runtime.renderAttackSummary();

    expect(attackSummary.canConfirm).toBe(false);
    expect(attackConfirmButton.disabled).toBe(true);
    expect(attackStatus.textContent).toBe("Vyber zbraně");
    expect(attackStatus.dataset.validationState).toBe("error");

    const robberyStatus = textElement();
    const robberyConfirmButton = textElement();
    const robberyRuntime = createDistrictActionPanelRuntime({
      clamp: (value, min, max) => Math.min(Math.max(value, min), max),
      elements: {
        robberySourceSelect: { value: "5", replaceChildren: vi.fn(), append: vi.fn(), disabled: false },
        robberyMemberInput: input("0"),
        robberyAvailableMembers: textElement(),
        robberyStatus,
        robberyConfirmButton,
        populationValue: textElement("10")
      }
    });

    const robberySummary = robberyRuntime.renderRobberySummary();

    expect(robberySummary.canConfirm).toBe(true);
    expect(robberyConfirmButton.disabled).toBe(false);
    expect(robberyRuntime.renderRobberySummary().deployedMembers).toBe(1);
    expect(robberyStatus.textContent).toBe("Připraveno · server ověří 1 volného člena");
    expect(robberyStatus.dataset.validationState).toBeUndefined();
  });

  it("keeps robbery canonical without a speculative scout preview", () => {
    const robberySourceSelect = { value: "5", replaceChildren: vi.fn(), append: vi.fn(), disabled: false };
    const robberyMemberInput = input("4");
    const robberyAvailableMembers = textElement();
    const robberyStatus = textElement();
    const robberyConfirmButton = textElement();
    const robberyRiskLevel = textElement();
    const robberyLootPreview = textElement();
    const robberyTrapPreview = textElement();
    const robberyScoutReport = textElement();
    const robberyRiskDescription = textElement();
    const previewFactory = vi.fn(({ hasScoutReport }) => ({
      zoneLabel: "Park",
      recommendationLabel: "6-10",
      previewRiskLabel: hasScoutReport ? "Medium" : "Neznámé / Odhad",
      previewSuccessChanceLabel: hasScoutReport ? "57%" : "Odhad",
      riskLabel: "Medium",
      successChanceLabel: "57%",
      previewLootLabel: hasScoutReport ? "Biomass / Chemicals" : "Nejistý",
      previewTrapHintLabel: hasScoutReport ? "Past nepotvrzena" : "Neznámá",
      scoutReportLabel: hasScoutReport ? "Scout report aktivní" : "Bez scout reportu",
      heatLabel: "+5",
      previewDescription: hasScoutReport ? "Scout report aktivní." : "Bez scout reportu je preview jen hrubý odhad."
    }));
    const runtime = createDistrictActionPanelRuntime({
      clamp: (value, min, max) => Math.min(Math.max(value, min), max),
      createRobberySetupPreview: previewFactory,
      getResolvedSpyIntel: () => ({
        occupiableDistrictIds: [],
        revealedTypeDistrictIds: [],
        revealedDefenseDistrictIds: []
      }),
      getResolvedSpyState: () => ({ available: 2 }),
      elements: {
        robberySourceSelect,
        robberyMemberInput,
        robberyAvailableMembers,
        robberyStatus,
        robberyConfirmButton,
        robberyRiskLevel,
        robberyLootPreview,
        robberyTrapPreview,
        robberyScoutReport,
        robberyRiskDescription,
        populationValue: textElement("10")
      }
    });

    runtime.populateRobberySetupPopup({ id: 12, districtType: "park" });
    robberySourceSelect.value = "5";
    robberyMemberInput.value = "4";
    const summary = runtime.renderRobberySummary();

    expect(summary.canConfirm).toBe(true);
    expect(robberyConfirmButton.disabled).toBe(false);
    expect(robberyMemberInput.value).toBe("1");
    expect(robberyMemberInput.disabled).toBe(true);
    expect(robberyAvailableMembers.textContent).toBe("10");
    expect(previewFactory).not.toHaveBeenCalled();
    expect(robberyRiskLevel.textContent).toBe("Výsledek po doběhnutí operace");
    expect(robberyLootPreview.textContent).toBe("Jen skutečný zbývající městský loot");
    expect(robberyTrapPreview.textContent).toBe("Bez odhadu pasti");
    expect(robberyScoutReport.textContent).toBe("Serverový stav cíle");
    expect(robberyRiskDescription.textContent).toContain("Populace se nenasazuje ani neodečítá");
  });

  it("keeps robbery population as a one-member condition and shows the canonical heat range", () => {
    const robberySourceSelect = { value: "5", replaceChildren: vi.fn(), append: vi.fn(), disabled: false };
    const robberyMemberInput = input("0");
    const robberyAvailableMembers = textElement();
    const robberyHeatEstimate = textElement();
    const runtime = createDistrictActionPanelRuntime({
      clamp: (value, min, max) => Math.min(Math.max(value, min), max),
      createRobberySetupPreview: vi.fn(({ sentMembers }) => ({
        zoneLabel: "Park",
        recommendationLabel: "6-10",
        riskLabel: "High",
        successChanceLabel: "31%",
        heatLabel: `+${sentMembers + 3}`
      })),
      elements: {
        robberySourceSelect,
        robberyMemberInput,
        robberyAvailableMembers,
        robberyHeatEstimate,
        robberySetupPopup: textElement(),
        robberyTargetTitle: textElement(),
        robberyStatus: textElement(),
        robberyConfirmButton: textElement(),
        populationValue: textElement("10")
      }
    });

    runtime.populateRobberySetupPopup({ id: 12, districtType: "park" });
    expect(robberyAvailableMembers.textContent).toBe("10");
    expect(robberyHeatEstimate.textContent).toBe("1–6");

    robberyMemberInput.value = "4";
    runtime.renderRobberySummary();

    expect(robberyMemberInput.value).toBe("1");
    expect(robberyMemberInput.disabled).toBe(true);
    expect(robberyAvailableMembers.textContent).toBe("10");
    expect(robberyHeatEstimate.textContent).toBe("1–6");
  });

  it("uses precomputed cooldown labels in robbery and occupy confirmations", () => {
    const robberyDuration = textElement();
    const robberyRuntime = createDistrictActionPanelRuntime({
      clamp: (value, min, max) => Math.min(Math.max(value, min), max),
      robberyCooldownMs: 10 * 60 * 1000,
      getRobberyCooldownView: () => ({
        effectiveCooldownMs: 9 * 60 * 1000,
        label: "9m 00s (-1m 00s)"
      }),
      elements: {
        robberySourceSelect: { value: "5", replaceChildren: vi.fn(), append: vi.fn(), disabled: false },
        robberyMemberInput: input("4"),
        robberyAvailableMembers: textElement(),
        robberyStatus: textElement(),
        robberyConfirmTitle: textElement(),
        robberyConfirmMembers: textElement(),
        robberyConfirmDuration: robberyDuration,
        robberyConfirmFinalButton: textElement(),
        populationValue: textElement("10")
      }
    });

    robberyRuntime.populateRobberyConfirmPopup({ id: 12, districtType: "park" });

    expect(robberyDuration.textContent).toBe("9m 00s (-1m 00s)");

    const occupyDuration = textElement();
    const occupyNote = textElement();
    const occupyRuntime = createDistrictActionPanelRuntime({
      getAdjacentDistrictIdsFromGeometry: () => [1],
      getCurrentPlayerOwnedDistrictIds: () => new Set([1]),
      getGeometry: () => ({}),
      getResolvedSpyIntel: () => ({ occupiableDistrictIds: [12] }),
      occupyCooldownMs: 12 * 60 * 1000,
      getOccupyCooldownView: () => ({
        effectiveCooldownMs: 11 * 60 * 1000,
        label: "11m 00s (-1m 00s)"
      }),
      elements: {
        occupyConfirmTitle: textElement(),
        occupyConfirmSource: textElement(),
        occupyConfirmCost: textElement(),
        occupyConfirmDuration: occupyDuration,
        occupyConfirmNote: occupyNote,
        occupyConfirmButton: textElement(),
        populationValue: textElement("100")
      }
    });

    occupyRuntime.populateOccupyConfirmPopup({ id: 12, districtType: "park" });

    expect(occupyDuration.textContent).toBe("11m 00s (-1m 00s)");
    expect(occupyNote.textContent).toContain("11m 00s (-1m 00s)");
  });
});
