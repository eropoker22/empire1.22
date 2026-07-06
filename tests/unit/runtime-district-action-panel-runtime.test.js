import { describe, expect, it, vi } from "vitest";
import { createDistrictActionPanelRuntime } from "../../page-assets/js/app/runtime/districtActionPanelRuntime.js";

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
      getFactoryAttackBoostContext: ({ attackPower, defensePower }) => ({
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
        gangMembersValue: textElement("12")
      }
    });

    const summary = runtime.renderAttackSummary();
    const context = runtime.getPreparedAttackContext({ id: 9, districtType: "industrial" });
    runtime.setPendingAttackContext(context);

    expect(summary).toEqual({ totalResidents: 3, totalPower: 12, canConfirm: true });
    expect(attackRequiredPopulation.textContent).toBe("3");
    expect(context.selectedWeaponsLabel).toBe("Pistole x2");
    expect(runtime.getPendingAttackContext()).toBe(context);

    runtime.clearPendingAttackContext();
    expect(runtime.getPendingAttackContext()).toBe(null);
  });

  it("handles missing panel DOM without crashing", () => {
    const runtime = createDistrictActionPanelRuntime({});

    expect(runtime.renderAttackSummary()).toEqual({ totalResidents: 0, totalPower: 0, canConfirm: false });
    expect(runtime.renderRobberySummary()).toEqual({ deployedMembers: 0, canConfirm: false });
    expect(runtime.renderDefenseSummary()).toEqual({ residents: 0, totalPower: 0, canConfirm: false });
    expect(() => runtime.populateTrapConfirmPopup({ id: 1 })).not.toThrow();
    expect(() => runtime.populateSpyConfirmPopup({ id: 1 })).not.toThrow();
  });

  it("marks setup status as an error while attack or robbery confirmation is blocked", () => {
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
        gangMembersValue: textElement("12")
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
        gangMembersValue: textElement("10")
      }
    });

    const robberySummary = robberyRuntime.renderRobberySummary();

    expect(robberySummary.canConfirm).toBe(false);
    expect(robberyConfirmButton.disabled).toBe(true);
    expect(robberyStatus.textContent).toBe("Vyber členy gangu");
    expect(robberyStatus.dataset.validationState).toBe("error");
  });

  it("keeps robbery confirmable without scout report while rendering rough preview labels", () => {
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
        gangMembersValue: textElement("10")
      }
    });

    runtime.populateRobberySetupPopup({ id: 12, districtType: "park" });
    robberySourceSelect.value = "5";
    robberyMemberInput.value = "4";
    const summary = runtime.renderRobberySummary();

    expect(summary.canConfirm).toBe(true);
    expect(robberyConfirmButton.disabled).toBe(false);
    expect(robberyAvailableMembers.textContent).toBe("10");
    expect(previewFactory).toHaveBeenLastCalledWith(expect.objectContaining({ hasScoutReport: false }));
    expect(robberyRiskLevel.textContent).toBe("Neznámé / Odhad · Odhad");
    expect(robberyLootPreview.textContent).toBe("Nejistý");
    expect(robberyTrapPreview.textContent).toBe("Neznámá");
    expect(robberyScoutReport.textContent).toBe("Bez scout reportu");
    expect(robberyRiskDescription.textContent).toContain("Bez scout reportu");
  });
});
