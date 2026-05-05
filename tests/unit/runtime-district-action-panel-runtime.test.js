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
});
