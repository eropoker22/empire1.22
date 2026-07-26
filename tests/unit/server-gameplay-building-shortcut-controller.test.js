// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServerGameplayBuildingShortcutController } from "../../page-assets/js/app/ui/serverGameplayBuildingShortcutController.js";

describe("server gameplay building shortcut controller", () => {
  beforeEach(() => {
    document.body.innerHTML = `<main id="game-root">
      <button data-buildings-popup-open>Budovy</button>
      <button data-pharmacy-popup-open>Lékárna</button>
      <button data-druglab-popup-open>Drug lab</button>
      <button data-factory-popup-open>Továrna</button>
      <button data-armory-popup-open>Zbrojovka</button>
    </main>`;
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("mounts once and opens the currently selected server district", async () => {
    const harness = createHarness({
      initialReadModel: readModel("district:1", ["casino"])
    });
    expect(harness.controller.mount()).toBe(true);
    expect(harness.controller.mount()).toBe(false);
    harness.controller.update(harness.current());

    document.querySelector("[data-buildings-popup-open]").click();
    await vi.waitFor(() => expect(harness.handleDistrictSelected).toHaveBeenCalledTimes(1));

    expect(harness.selectDistrict).not.toHaveBeenCalled();
    expect(harness.handleDistrictSelected.mock.calls[0][0].districtId).toBe("district:1");
    expect(harness.openBuildingByType).not.toHaveBeenCalled();
  });

  it("uses targeted authoritative loads until the requested building is found", async () => {
    const initial = readModel("district:1", ["casino"]);
    const drugLab = readModel("district:2", ["drug-lab"]);
    const harness = createHarness({
      initialReadModel: initial,
      selectedById: { "district:2": drugLab }
    });
    harness.controller.mount();
    harness.controller.update(initial);

    document.querySelector("[data-druglab-popup-open]").click();
    await vi.waitFor(() => expect(harness.openBuildingByType).toHaveBeenCalledWith("drug_lab"));

    expect(harness.selectDistrict).toHaveBeenCalledTimes(1);
    expect(harness.selectDistrict).toHaveBeenCalledWith("district:2");
    expect(harness.handleDistrictSelected.mock.calls[0][0]).toMatchObject({
      districtId: "district:2",
      response: { accepted: true, readModel: drugLab }
    });
    expect(harness.submitCommand).not.toHaveBeenCalled();
  });

  it("prefers the server-projected factory district hint", async () => {
    const initial = readModel("district:1", ["casino"]);
    initial.player.factoryProduction = { districtId: "district:3", buildingId: "factory:3" };
    const factory = readModel("district:3", ["factory"]);
    const harness = createHarness({
      initialReadModel: initial,
      selectedById: { "district:3": factory }
    });
    harness.controller.mount();
    harness.controller.update(initial);

    document.querySelector("[data-factory-popup-open]").click();
    await vi.waitFor(() => expect(harness.openBuildingByType).toHaveBeenCalledWith("factory"));

    expect(harness.selectDistrict).toHaveBeenCalledTimes(1);
    expect(harness.selectDistrict).toHaveBeenCalledWith("district:3");
  });

  it("skips concurrent activation and ignores late loads after destroy", async () => {
    let resolveSelection;
    const selection = new Promise((resolve) => {
      resolveSelection = resolve;
    });
    const initial = readModel("district:1", ["casino"]);
    const harness = createHarness({ initialReadModel: initial });
    harness.selectDistrict.mockReturnValue(selection);
    harness.controller.mount();
    harness.controller.update(initial);

    const button = document.querySelector("[data-armory-popup-open]");
    button.click();
    button.click();
    await Promise.resolve();
    expect(harness.selectDistrict).toHaveBeenCalledTimes(1);
    expect(harness.controller.getDiagnostics().skippedWhilePending).toBe(1);

    expect(harness.controller.destroy()).toBe(true);
    resolveSelection(authoritativeSelection(readModel("district:2", ["armory"])));
    await Promise.resolve();
    await Promise.resolve();
    expect(harness.handleDistrictSelected).not.toHaveBeenCalled();

    button.click();
    expect(harness.selectDistrict).toHaveBeenCalledTimes(1);
    expect(harness.controller.destroy()).toBe(false);
  });
});

function createHarness({ initialReadModel, selectedById = {} }) {
  let currentReadModel = initialReadModel;
  let currentRenderState = renderState(initialReadModel.district.districtId);
  const handleDistrictSelected = vi.fn(() => true);
  const openBuildingByType = vi.fn(async () => true);
  const submitCommand = vi.fn();
  const selectDistrict = vi.fn(async (districtId) => {
    const next = selectedById[districtId];
    if (!next) return { accepted: false, errors: [{ message: "Nenalezeno" }] };
    currentReadModel = next;
    currentRenderState = renderState(districtId);
    return authoritativeSelection(next);
  });
  const source = {
    getCurrentReadModel: () => currentReadModel,
    getCurrentRenderState: () => currentRenderState,
    selectDistrict,
    submitCommand
  };
  const districtController = { handleDistrictSelected, openBuildingByType };
  return {
    controller: createServerGameplayBuildingShortcutController({
      root: document.querySelector("#game-root"),
      source,
      districtController
    }),
    current: () => currentReadModel,
    handleDistrictSelected,
    openBuildingByType,
    selectDistrict,
    submitCommand
  };
}

function readModel(selectedDistrictId, buildingTypes) {
  return {
    player: {
      playerId: "player:1",
      homeDistrictId: "district:1"
    },
    districts: [
      ownedDistrict("district:1"),
      ownedDistrict("district:2"),
      ownedDistrict("district:3")
    ],
    district: {
      districtId: selectedDistrictId,
      ownerPlayerId: "player:1",
      isOwnedByPlayer: true,
      buildings: buildingTypes.map((buildingTypeId) => ({
        buildingId: `${selectedDistrictId}:${buildingTypeId}`,
        buildingTypeId
      }))
    }
  };
}

function ownedDistrict(districtId) {
  return {
    districtId,
    ownerPlayerId: "player:1",
    isOwnedByPlayer: true,
    filledSlotCount: 2
  };
}

function renderState(districtId) {
  return { districtPanel: { districtId } };
}

function authoritativeSelection(readModel) {
  return {
    accepted: true,
    readModel,
    renderState: renderState(readModel.district.districtId)
  };
}
