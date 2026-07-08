import { describe, expect, it } from "vitest";
import {
  canRenderRobberyConfirmationPanel,
  createAttackConfirmationViewModel,
  createOccupyConfirmationViewModel,
  createSpyConfirmationViewModel,
  renderAttackConfirmationPanel,
  createTrapConfirmationViewModel,
  renderOccupyConfirmationPanel,
  renderPreparedRobberyConfirmationPanel,
  renderSpyConfirmationPanel,
  renderTrapConfirmationPanel
} from "../../page-assets/js/app/ui/districtActionConfirmationPanel.js";

function element() {
  return {
    textContent: "",
    disabled: false,
    dataset: {},
    src: "",
    alt: ""
  };
}

describe("district action confirmation panel", () => {
  it("builds attack confirmation view-model without applying the action", () => {
    const viewModel = createAttackConfirmationViewModel({
      district: { id: 12 },
      attackCooldownMs: 22 * 60 * 1000,
      context: {
        sourceDistrictId: 4,
        totalResidents: 3,
        totalPower: 42,
        powerLabel: "64 (+2)",
        bonusPowerLabel: "+2",
        canConfirm: true,
        selectedWeaponsLabel: "Pistole x2",
        resolvedScenario: { label: "Úspěch" },
        boostContext: {
          cooldownMs: 15 * 60 * 1000,
          effectiveAttackPower: 64,
          summaryLabel: "Bonus továrny +22"
        }
      },
      atmosphereMeta: { typeKey: "downtown", label: "Downtown", imagePath: "img/downtown.webp" }
    });

    expect(viewModel).toMatchObject({
      targetDistrictId: 12,
      sourceLabel: "District 4",
      totalResidents: 3,
      attackPower: 64,
      powerLabel: "64 (+2)",
      scenarioLabel: "Úspěch",
      durationLabel: "15m",
      note: "Výzbroj: Pistole x2. Bonus továrny +22.",
      canConfirm: true
    });
  });

  it("renders trap confirmation state as DOM-only presentation", () => {
    const title = element();
    const cooldown = element();
    const note = element();
    const button = element();
    const card = element();
    const image = element();
    const label = element();

    const viewModel = createTrapConfirmationViewModel({
      district: { id: 9 },
      currentTrapDistrictId: 5,
      trapMoveCooldownSeconds: 7,
      atmosphereMeta: { typeKey: "industrial", label: "Industrial", imagePath: "img/industrial.webp" }
    });

    renderTrapConfirmationPanel(viewModel, {
      trapConfirmTitle: title,
      trapConfirmCooldown: cooldown,
      trapConfirmNote: note,
      trapConfirmButton: button,
      trapConfirmCard: card,
      trapConfirmAtmosphereImage: image,
      trapConfirmAtmosphereLabel: label
    });

    expect(title.textContent).toBe("District 9");
    expect(cooldown.textContent).toBe("0:07");
    expect(note.textContent).toBe("Přesune aktivní toxickou past z District 5 sem. Po přesunu se znovu rozjede toxický kouř.");
    expect(button.textContent).toBe("Přesunout past");
    expect(button.disabled).toBe(true);
    expect(card.dataset.districtType).toBe("industrial");
    expect(image.src).toBe("img/industrial.webp");
    expect(image.dataset.atmosphereImagePath).toBe("img/industrial.webp");
    expect(label.textContent).toBe("Industrial");
  });

  it("renders robbery confirmation as presentation-only state", () => {
    const title = element();
    const source = element();
    const members = element();
    const duration = element();
    const note = element();
    const button = element();
    const card = element();
    const image = element();
    const label = element();

    const elements = {
      robberyConfirmTitle: title,
      robberyConfirmSource: source,
      robberyConfirmMembers: members,
      robberyConfirmDuration: duration,
      robberyConfirmNote: note,
      robberyConfirmFinalButton: button,
      robberyConfirmCard: card,
      robberyConfirmAtmosphereImage: image,
      robberyConfirmAtmosphereLabel: label
    };

    expect(canRenderRobberyConfirmationPanel({ district: { id: 17 }, elements })).toBe(true);
    expect(renderPreparedRobberyConfirmationPanel({
      district: { id: 17 },
      sourceDistrictId: 4,
      deployedMembers: 8,
      canConfirm: true,
      robberyCooldownMs: 14 * 60 * 1000,
      atmosphereMeta: { typeKey: "commercial", label: "Commercial", imagePath: "img/commercial.webp" }
    }, elements)).toBe(true);

    expect(title.textContent).toBe("District 17");
    expect(source.textContent).toBe("District 4");
    expect(members.textContent).toBe("8");
    expect(duration.textContent).toBe("14m");
    expect(note.textContent).toBe("Vykrást district cílí jen na prázdný sousední district. Neobsazuje území, pouze získává loot z města.");
    expect(button.disabled).toBe(false);
    expect(card.dataset.districtType).toBe("commercial");
    expect(image.src).toBe("img/commercial.webp");
    expect(image.dataset.atmosphereImagePath).toBe("img/commercial.webp");
    expect(label.textContent).toBe("Commercial");
  });

  it("renders robbery confirmation without optional source and note rows", () => {
    const title = element();
    const members = element();
    const duration = element();
    const button = element();
    const elements = {
      robberyConfirmTitle: title,
      robberyConfirmMembers: members,
      robberyConfirmDuration: duration,
      robberyConfirmFinalButton: button
    };

    expect(canRenderRobberyConfirmationPanel({ district: { id: 17 }, elements })).toBe(true);
    expect(renderPreparedRobberyConfirmationPanel({
      district: { id: 17 },
      sourceDistrictId: 4,
      deployedMembers: 8,
      canConfirm: true,
      robberyCooldownMs: 14 * 60 * 1000
    }, elements)).toBe(true);

    expect(title.textContent).toBe("District 17");
    expect(members.textContent).toBe("8");
    expect(duration.textContent).toBe("14m");
    expect(button.disabled).toBe(false);
  });

  it("renders occupy confirmation without changing gameplay state", () => {
    const title = element();
    const source = element();
    const condition = element();
    const cost = element();
    const duration = element();
    const note = element();
    const button = element();

    const viewModel = createOccupyConfirmationViewModel({
      district: { id: 15 },
      adjacentOwnedDistrictIds: [3],
      canOccupyAfterSpy: true,
      ownedDistrictCount: 1,
      availablePopulation: 50,
      occupyCooldownMs: 12 * 60 * 1000
    });

    renderOccupyConfirmationPanel(viewModel, {
      occupyConfirmTitle: title,
      occupyConfirmSource: source,
      occupyConfirmCondition: condition,
      occupyConfirmCost: cost,
      occupyConfirmDuration: duration,
      occupyConfirmNote: note,
      occupyConfirmButton: button
    });

    expect(title.textContent).toBe("District 15");
    expect(source.textContent).toBe("District 3");
    expect(condition.textContent).toBe("Špehování potvrzeno");
    expect(cost.textContent).toBe("50 populace");
    expect(duration.textContent).toBe("12m");
    expect(note.textContent).toBe("Po potvrzení se spustí 12m obsazování. District bliká tvojí barvou a po doběhnutí přejde pod tebe.");
    expect(button.textContent).toBe("Spustit obsazení");
    expect(button.disabled).toBe(false);
  });

  it("shows the higher occupy population cost and blocks confirmation when population is low", () => {
    const source = element();
    const condition = element();
    const cost = element();
    const button = element();
    const viewModel = createOccupyConfirmationViewModel({
      district: { id: 18 },
      adjacentOwnedDistrictIds: [15],
      canOccupyAfterSpy: true,
      ownedDistrictCount: 2,
      availablePopulation: 249,
      occupyCooldownMs: 12 * 60 * 1000
    });

    expect(viewModel.conditionLabel).toBe("Špehování potvrzeno");
    expect(viewModel.costLabel).toBe("250 populace");
    expect(viewModel.note).toBe("Obsazení vyžaduje 250 populace. Aktuálně máš 249.");
    expect(viewModel.canConfirm).toBe(false);

    renderOccupyConfirmationPanel(viewModel, {
      occupyConfirmTitle: element(),
      occupyConfirmSource: source,
      occupyConfirmCondition: condition,
      occupyConfirmCost: cost,
      occupyConfirmDuration: element(),
      occupyConfirmNote: element(),
      occupyConfirmButton: button
    });

    expect(button.disabled).toBe(true);
    expect(source.dataset.validationState).toBeUndefined();
    expect(condition.dataset.validationState).toBeUndefined();
    expect(cost.dataset.validationState).toBe("error");
  });

  it("marks missing spies in the spy confirmation cell", () => {
    const source = element();
    const available = element();
    const image = { src: "", alt: "", dataset: {} };
    const label = element();
    const button = element();
    const viewModel = createSpyConfirmationViewModel({
      district: { id: 6 },
      adjacentOwnedDistrictIds: [1],
      spyState: { available: 0 },
      spyCooldownMs: 20_000,
      atmosphereMeta: { typeKey: "park", label: "Parkový sektor", imagePath: "img/park.webp" }
    });

    renderSpyConfirmationPanel(viewModel, {
      spyConfirmCard: element(),
      spyConfirmAtmosphereImage: image,
      spyConfirmAtmosphereLabel: label,
      spyConfirmTitle: element(),
      spyConfirmSource: source,
      spyConfirmAvailable: available,
      spyConfirmDuration: element(),
      spyConfirmNote: element(),
      spyConfirmButton: button
    });

    expect(button.disabled).toBe(true);
    expect(source.dataset.validationState).toBeUndefined();
    expect(available.dataset.validationState).toBe("error");
    expect(image.src).toBe("img/park.webp");
    expect(label.textContent).toBe("Parkový sektor");
  });

  it("marks empty attack loadout in the attack confirmation members cell", () => {
    const members = element();
    const power = element();
    const button = element();
    const viewModel = createAttackConfirmationViewModel({
      district: { id: 12 },
      context: {
        sourceDistrictId: 4,
        totalResidents: 0,
        totalPower: 0,
        canConfirm: false,
        selectedWeaponsLabel: "",
        resolvedScenario: { label: "Neznámý" },
        boostContext: { cooldownMs: 10_000, effectiveAttackPower: 0 }
      }
    });

    renderAttackConfirmationPanel(viewModel, {
      attackConfirmTitle: element(),
      attackConfirmSource: element(),
      attackConfirmMembers: members,
      attackConfirmPower: power,
      attackConfirmScenario: element(),
      attackConfirmDuration: element(),
      attackConfirmNote: element(),
      attackConfirmFinalButton: button
    });

    expect(button.disabled).toBe(true);
    expect(members.dataset.validationState).toBe("error");
    expect(power.dataset.validationState).toBeUndefined();
  });
});
