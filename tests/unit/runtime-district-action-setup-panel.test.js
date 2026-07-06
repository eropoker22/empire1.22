import { describe, expect, it, vi } from "vitest";
import {
  createAttackSetupViewModel,
  createDefenseSetupViewModel,
  createRobberySetupViewModel,
  renderAttackSetupPanel,
  renderDefenseSetupPanel,
  renderRobberySetupPanel
} from "../../page-assets/js/app/ui/districtActionSetupPanel.js";

class FakeElement {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.dataset = {};
    this.disabled = false;
    this.textContent = "";
    this.value = "";
    this.max = "";
    this.src = "";
    this.alt = "";
    this.ownerDocument = {
      createElement: (childTagName) => new FakeElement(childTagName)
    };
  }

  hasAttribute(name) {
    if (!name.startsWith("data-")) {
      return false;
    }

    const datasetKey = name
      .slice(5)
      .replace(/-([a-z])/g, (_, character) => character.toUpperCase());
    return Object.prototype.hasOwnProperty.call(this.dataset, datasetKey);
  }

  append(child) {
    this.children.push(child);
    if (this.tagName === "SELECT" && !this.value && child.value !== undefined) {
      this.value = child.value;
    }
  }

  replaceChildren(...children) {
    this.children = [];
    this.value = "";
    for (const child of children) {
      this.append(child);
    }
  }
}

function element(tagName = "div", dataset = {}) {
  const node = new FakeElement(tagName);
  node.dataset = { ...dataset };
  return node;
}

describe("district action setup panel", () => {
  it("builds and renders attack setup view-model through the existing attack panel renderer", () => {
    const renderAttackPanel = vi.fn(() => true);
    const viewModel = createAttackSetupViewModel({
      district: { id: 7 },
      adjacentOwnedDistrictIds: [2],
      weaponInventory: { pistol: 3 },
      atmosphereMeta: { typeKey: "industrial", label: "Industrial" }
    });

    expect(renderAttackSetupPanel(viewModel, { attackTargetTitle: element() }, { renderAttackPanel })).toBe(true);
    expect(renderAttackPanel).toHaveBeenCalledWith(
      expect.objectContaining({
        targetDistrictId: 7,
        sourceDistrictIds: [2],
        weaponInventory: { pistol: 3 },
        atmosphereMeta: { typeKey: "industrial", label: "Industrial" }
      }),
      {},
      expect.objectContaining({
        elements: expect.objectContaining({ title: expect.any(FakeElement) })
      })
    );
  });

  it("renders robbery setup select and default member input without binding listeners", () => {
    const title = element();
    const sourceSelect = element("select");
    const memberInput = element("input");
    const card = element();
    const image = element("img");
    const label = element();
    const zone = element();
    const recommendation = element();
    const risk = element();
    const loot = element();
    const trap = element();
    const scout = element();
    const heat = element();
    const riskDescription = element();
    const availableMembers = element();

    const viewModel = createRobberySetupViewModel({
      district: { id: 12 },
      adjacentOwnedDistrictIds: [5],
      availableMembers: 9,
      robberyPreview: {
        zoneLabel: "Commercial",
        recommendationLabel: "16-26",
        riskLabel: "High",
        successChanceLabel: "31%",
        previewRiskLabel: "Neznámé / Odhad",
        previewSuccessChanceLabel: "Odhad",
        previewLootLabel: "Nejistý",
        previewTrapHintLabel: "Neznámá",
        scoutReportLabel: "Bez scout reportu",
        heatLabel: "+11",
        riskDescription: "Pod doporučením.",
        previewDescription: "Bez scout reportu je preview jen hrubý odhad."
      },
      atmosphereMeta: { typeKey: "commercial", label: "Commercial", imagePath: "img/commercial.webp" }
    });

    renderRobberySetupPanel(viewModel, {
      robberyTargetTitle: title,
      robberySourceSelect: sourceSelect,
      robberyMemberInput: memberInput,
      robberySetupCard: card,
      robberySetupAtmosphereImage: image,
      robberySetupAtmosphereLabel: label,
      robberyAvailableMembers: availableMembers,
      robberyZone: zone,
      robberyRecommendation: recommendation,
      robberyRiskLevel: risk,
      robberyLootPreview: loot,
      robberyTrapPreview: trap,
      robberyScoutReport: scout,
      robberyHeatEstimate: heat,
      robberyRiskDescription: riskDescription
    });

    expect(title.textContent).toBe("District 12");
    expect(sourceSelect.children.map((child) => child.textContent)).toEqual(["Vyber district", "District 5"]);
    expect(sourceSelect.value).toBe("5");
    expect(sourceSelect.disabled).toBe(false);
    expect(memberInput.value).toBe("0");
    expect(memberInput.max).toBe("9");
    expect(availableMembers.textContent).toBe("9");
    expect(card.dataset.districtType).toBe("commercial");
    expect(image.src).toBe("img/commercial.webp");
    expect(label.textContent).toBe("Commercial");
    expect(zone.textContent).toBe("Commercial");
    expect(recommendation.textContent).toBe("16-26 členů");
    expect(risk.textContent).toBe("Neznámé / Odhad · Odhad");
    expect(loot.textContent).toBe("Nejistý");
    expect(trap.textContent).toBe("Neznámá");
    expect(scout.textContent).toBe("Bez scout reportu");
    expect(heat.textContent).toBe("+11");
    expect(riskDescription.textContent).toBe("Bez scout reportu je preview jen hrubý odhad.");
  });

  it("auto-selects the first robbery source when the source control is hidden from the layout", () => {
    const sourceSelect = element("select", { autoSelectFirstSource: "" });

    renderRobberySetupPanel(
      createRobberySetupViewModel({
        district: { id: 14 },
        adjacentOwnedDistrictIds: [3, 8],
        availableMembers: 12
      }),
      {
        robberyTargetTitle: element(),
        robberySourceSelect: sourceSelect,
        robberyMemberInput: element("input")
      }
    );

    expect(sourceSelect.children.map((child) => child.textContent)).toEqual(["Vyber district", "District 3", "District 8"]);
    expect(sourceSelect.value).toBe("3");
    expect(sourceSelect.disabled).toBe(false);
  });

  it("renders defense setup inventory and current loadout as presentation state", () => {
    const title = element();
    const residentsInput = element("input");
    const batOwned = element("span", { defenseOwned: "bat" });
    const alarmOwned = element("span", { defenseOwned: "alarm" });
    const batInput = element("input", { defenseWeaponInput: "bat" });
    const alarmInput = element("input", { defenseWeaponInput: "alarm" });
    const emptyInput = element("input", { defenseWeaponInput: "camera" });

    const viewModel = createDefenseSetupViewModel({
      district: { id: 20 },
      weaponInventory: { bat: 4, alarm: 0 },
      currentDefense: { residents: 3, loadout: { bat: 2, alarm: 1 } }
    });

    renderDefenseSetupPanel(viewModel, {
      defenseTargetTitle: title,
      defenseResidentsInput: residentsInput,
      defenseOwnedElements: [batOwned, alarmOwned],
      defenseWeaponInputs: [batInput, alarmInput, emptyInput]
    });

    expect(title.textContent).toBe("District 20");
    expect(batOwned.textContent).toBe("6");
    expect(alarmOwned.textContent).toBe("1");
    expect(batInput.value).toBe("2");
    expect(batInput.max).toBe("6");
    expect(batInput.disabled).toBe(false);
    expect(alarmInput.value).toBe("1");
    expect(alarmInput.max).toBe("1");
    expect(alarmInput.disabled).toBe(false);
    expect(emptyInput.value).toBe("0");
    expect(emptyInput.max).toBe("0");
    expect(emptyInput.disabled).toBe(true);
    expect(residentsInput.value).toBe("3");
  });
});
