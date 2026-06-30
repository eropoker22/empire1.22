// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createBuildingUpgradeConfirmationController } from "../../page-assets/js/app/runtime/buildingUpgradeConfirmation.js";
import {
  createBuildingUpgradeConfirmationViewModel,
  resolveBuildingUpgradeBenefits
} from "../../page-assets/js/app/runtime/buildingUpgradeBenefits.js";
import { expectNoGenericBuildingCardCopy } from "./helpers/building-card-test-helpers.js";

describe("building upgrade confirmation benefits", () => {
  it("uses building type label in the headline instead of the instance name", () => {
    const model = createBuildingUpgradeConfirmationViewModel({
      buildingName: "Rekrutační centrum",
      displayName: "Urban Soldiers Hub",
      currentMechanics: {
        mechanicsType: "recruitment-center",
        level: 1,
        nextLevel: 2,
        upgradeCostLabel: "$15,984",
        cleanHourly: 2100
      },
      nextMechanics: {
        mechanicsType: "recruitment-center",
        level: 2,
        cleanHourly: 2394
      },
      resourceStatus: { canConfirm: true, missing: [] }
    });

    expect(model.titleLabel).toBe("Rekrutační centrum · L1 → L2");
    expect(model.titleLabel).not.toContain("Urban Soldiers Hub");
  });

  it("keeps the real price in the payment strip", () => {
    const model = createBuildingUpgradeConfirmationViewModel({
      buildingName: "Kasino",
      currentMechanics: {
        mechanicsType: "casino",
        level: 1,
        nextLevel: 2,
        upgradeCostLabel: "$7,500",
        cleanHourly: 100,
        casinoLaunderingCapacity: 18000,
        casinoLaunderingFeePct: 9
      },
      nextMechanics: {
        mechanicsType: "casino",
        level: 2,
        cleanHourly: 112,
        casinoLaunderingCapacity: 19440,
        casinoLaunderingFeePct: 9
      },
      resourceStatus: { canConfirm: true, missing: [] }
    });

    expect(model.costLabel).toBe("$7,500");
    expect(model.noteLabel).toBe("Po potvrzení zaplatíš $7,500.");
  });

  it("does not emit the old generic upgrade copy", () => {
    const model = createBuildingUpgradeConfirmationViewModel({
      buildingName: "Restaurace",
      currentMechanics: {
        mechanicsType: "restaurant",
        level: 1,
        nextLevel: 2,
        upgradeCostLabel: "$1,500",
        cleanHourly: 180,
        dirtyHourly: 120
      },
      nextMechanics: {
        mechanicsType: "restaurant",
        level: 2,
        cleanHourly: 205,
        dirtyHourly: 137
      },
      resourceStatus: { canConfirm: true, missing: [] }
    });
    const serialized = JSON.stringify(model);

    expect(serialized).not.toContain("silnější cashflow");
    expect(serialized).not.toContain("lokální efekty");
    expect(serialized).not.toContain("posílí svoje efekty podle typu budovy");
  });

  it("returns concrete casino income and laundering benefits", () => {
    const { benefits } = resolveBuildingUpgradeBenefits({
      currentMechanics: {
        mechanicsType: "casino",
        level: 1,
        cleanHourly: 600,
        dirtyHourly: 300,
        casinoLaunderingCapacity: 18000,
        casinoLaunderingFeePct: 9
      },
      nextMechanics: {
        mechanicsType: "casino",
        level: 2,
        cleanHourly: 672,
        dirtyHourly: 336,
        casinoLaunderingCapacity: 19440,
        casinoLaunderingFeePct: 9
      }
    });

    expect(benefits.map((benefit) => benefit.label)).toContain("Kapacita praní");
    expect(benefits.map((benefit) => benefit.label)).toContain("Clean cash");
    expect(benefits.find((benefit) => benefit.label === "Kapacita praní")?.value).toBe("+$1440");
  });

  it("returns concrete apartment population and capacity benefits when supplied", () => {
    const { benefits } = resolveBuildingUpgradeBenefits({
      currentMechanics: {
        mechanicsType: "apartment-block",
        level: 1,
        apartmentPopulationPerMinute: 2,
        apartmentCapacity: 50
      },
      nextMechanics: {
        mechanicsType: "apartment-block",
        level: 2,
        apartmentPopulationPerMinute: 2.24,
        apartmentCapacity: 60
      }
    });

    expect(benefits.map((benefit) => benefit.label)).toEqual(["Populace / min", "Kapacita obyvatel", "Level bonus"]);
  });

  it("returns concrete recruitment center support benefits when supplied", () => {
    const { benefits } = resolveBuildingUpgradeBenefits({
      currentMechanics: {
        mechanicsType: "recruitment-center",
        level: 1,
        recruitmentSupport: {
          populationProductionBonusPct: 3,
          apartmentCapacityBonusPct: 4,
          attackWeaponStrengthBonusPct: 2,
          defenseItemStrengthBonusPct: 1.5
        }
      },
      nextMechanics: {
        mechanicsType: "recruitment-center",
        level: 2,
        recruitmentSupport: {
          populationProductionBonusPct: 6,
          apartmentCapacityBonusPct: 8,
          attackWeaponStrengthBonusPct: 4,
          defenseItemStrengthBonusPct: 3
        }
      }
    });

    expect(benefits.map((benefit) => benefit.label)).toEqual(["Nábor obyvatel", "Kapacita bloků", "Síla útoku"]);
    expect(benefits.find((benefit) => benefit.label === "Nábor obyvatel")?.value).toBe("+3%");
    expect(benefits.find((benefit) => benefit.label === "Síla útoku")?.detail).toBe("2% → 4%");
  });

  it("returns concrete school student production and capacity benefits when supplied", () => {
    const { benefits } = resolveBuildingUpgradeBenefits({
      currentMechanics: {
        mechanicsType: "school",
        level: 1,
        schoolPopulationPerMinute: 0.25,
        schoolCapacity: 12
      },
      nextMechanics: {
        mechanicsType: "school",
        level: 2,
        schoolPopulationPerMinute: 0.29,
        schoolCapacity: 15
      }
    });

    expect(benefits.map((benefit) => benefit.label)).toEqual(["Studenti / min", "Kapacita studentů", "Level bonus"]);
    expect(benefits.find((benefit) => benefit.label === "Studenti / min")?.value).toBe("+0.04");
  });

  it("returns concrete clinic recovery and income benefits when supplied", () => {
    const { benefits } = resolveBuildingUpgradeBenefits({
      currentMechanics: {
        mechanicsType: "clinic",
        level: 1,
        cleanHourly: 3300,
        clinicRecoveryRatePct: 15
      },
      nextMechanics: {
        mechanicsType: "clinic",
        level: 2,
        cleanHourly: 3465,
        clinicRecoveryRatePct: 18
      }
    });

    expect(benefits.map((benefit) => benefit.label)).toEqual(["Recovery rate", "Clean cash", "Level bonus"]);
    expect(benefits.find((benefit) => benefit.label === "Recovery rate")?.value).toBe("+3%");
  });

  it("returns concrete exchange laundering benefit when supplied", () => {
    const { benefits } = resolveBuildingUpgradeBenefits({
      currentMechanics: {
        mechanicsType: "exchange",
        level: 1,
        exchangeLaunderingCapacity: 6000,
        cleanHourly: 100
      },
      nextMechanics: {
        mechanicsType: "exchange",
        level: 2,
        exchangeLaunderingCapacity: 6600,
        cleanHourly: 114
      }
    });

    expect(benefits.find((benefit) => benefit.label === "Kapacita praní")?.value).toBe("+$600");
  });

  it("falls back safely without fake numbers when no concrete value changes", () => {
    const result = resolveBuildingUpgradeBenefits({
      currentMechanics: {
        mechanicsType: "warehouse",
        level: 1,
        cleanHourly: 100
      },
      nextMechanics: {
        mechanicsType: "warehouse",
        level: 1,
        cleanHourly: 100
      }
    });

    expect(result.hasFallback).toBe(true);
    expect(result.benefits[0].value).toBe("Zatím není definovaný");
    expect(JSON.stringify(result)).not.toContain("+12");
    expectNoGenericBuildingCardCopy(result);
  });

  it("keeps residential upgrade modal headline on type label and concrete benefits", () => {
    const model = createBuildingUpgradeConfirmationViewModel({
      buildingName: "Klinika",
      displayName: "BlackCross Medical",
      currentMechanics: {
        mechanicsType: "clinic",
        level: 1,
        nextLevel: 2,
        upgradeCostLabel: "$6,500",
        cleanHourly: 3300,
        clinicRecoveryRatePct: 15
      },
      nextMechanics: {
        mechanicsType: "clinic",
        level: 2,
        cleanHourly: 3465,
        clinicRecoveryRatePct: 18
      },
      resourceStatus: { canConfirm: true, missing: [] }
    });

    expect(model.titleLabel).toBe("Klinika · L1 → L2");
    expect(model.titleLabel).not.toContain("BlackCross Medical");
    expect(model.benefits.map((benefit) => benefit.label)).toContain("Recovery rate");
    expectNoGenericBuildingCardCopy(model);
  });

  it("renders the modern modal structure with price, upgrade, benefits and buttons", () => {
    const host = document.createElement("div");
    const controller = createBuildingUpgradeConfirmationController({
      documentRef: document,
      host,
      variant: "district"
    });

    controller.update({
      buildingLabel: "Kasino",
      titleLabel: "Kasino · L1 → L2",
      description: "Potvrzením posuneš typ budovy na vyšší úroveň a okamžitě získáš nové bonusy.",
      costLabel: "$7,500",
      upgradeLabel: "L1 → L2",
      benefits: [
        { icon: "$", label: "Clean cash", value: "+$72", detail: "$600/hod → $672/hod" },
        { icon: "$", label: "Kapacita praní", value: "+$1,440", detail: "$18,000 → $19,440" }
      ],
      noteLabel: "Po potvrzení zaplatíš $7,500."
    });

    expect(host.querySelector(".building-upgrade-confirm__title")?.textContent).toBe("Kasino · L1 → L2");
    expect(host.querySelector(".building-upgrade-confirm__stat--cost")?.textContent).toContain("$7,500");
    expect(host.querySelector(".building-upgrade-confirm__stat--level")?.textContent).toContain("L1 → L2");
    expect(host.querySelectorAll(".building-upgrade-confirm__benefit")).toHaveLength(2);
    expect(host.querySelector(".building-upgrade-confirm__payment-strip")?.textContent).toContain("Po potvrzení zaplatíš $7,500.");
    expect(host.querySelector(".building-upgrade-confirm__button--ghost")?.textContent).toBe("Zpět");
    expect(host.querySelector(".building-upgrade-confirm__button--confirm")?.textContent).toBe("Potvrdit upgrade");
  });
});
