// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createServerGameplayBuildingDetailController
} from "../../page-assets/js/app/ui/serverGameplayBuildingDetailController.js";

describe("server gameplay building detail controller", () => {
  beforeEach(() => {
    resetOverlayCoordinator();
    document.body.innerHTML = "<main id=\"game-root\"></main>";
  });

  afterEach(() => {
    document.body.innerHTML = "";
    resetOverlayCoordinator();
  });

  it("requires shared confirmation and dispatches exact projected input values", async () => {
    const harness = createStockExchangeHarness();
    expect(harness.controller.mount()).toBe(true);
    expect(harness.controller.open(harness.buildingId)).toBe(true);

    const action = document.querySelector(
      "[data-district-building-detail-action-id='speculative_buy']"
    );
    const targetCategory = action
      .closest("[data-building-action-inputs]")
      .querySelector("[data-building-action-input='targetCategory']");
    const investment = action
      .closest("[data-building-action-inputs]")
      .querySelector("[data-building-action-input='investmentCleanCash']");
    targetCategory.value = "electronics";
    targetCategory.dispatchEvent(new Event("change", { bubbles: true }));
    investment.value = "2750";
    investment.dispatchEvent(new Event("input", { bubbles: true }));
    expect(action.disabled).toBe(false);

    action.click();
    const confirmation = await waitForConfirmation();
    expect(confirmation.textContent).toContain("Kategorie marketu: Electronics");
    expect(confirmation.textContent).toContain("Investice: 2750");
    confirmation.querySelector(".building-special-action-confirm__button--ghost").click();
    await vi.waitFor(() => expect(confirmation.hidden).toBe(true));
    expect(harness.dispatchSurfaceAction).not.toHaveBeenCalled();

    action.click();
    const reopenedConfirmation = await waitForConfirmation();
    reopenedConfirmation.querySelector(".building-special-action-confirm__button--confirm").click();

    await vi.waitFor(() => expect(harness.dispatchSurfaceAction).toHaveBeenCalledTimes(1));
    expect(harness.dispatchSurfaceAction).toHaveBeenCalledWith({
      buildingActionBuildingId: harness.buildingId,
      buildingActionDistrictId: "district:79",
      buildingActionId: "speculative_buy",
      buildingActionInputs: {
        targetCategory: "electronics",
        investmentCleanCash: 2750
      },
      targetCategory: "electronics",
      investmentCleanCash: 2750
    });
    expect(harness.controller.destroy()).toBe(true);
  });
});

function createStockExchangeHarness() {
  const buildingId = "building:district-79:stock-exchange:1";
  const action = {
    buildingId,
    buildingTypeId: "stock_exchange",
    actionId: "speculative_buy",
    label: "Spekulativní nákup",
    description: "Investuje vybranou částku do materiálového marketu.",
    enabled: true,
    disabled: false,
    disabledReason: null,
    inputSummary: "$2500 clean",
    outputSummary: ["Výsledek určí server"],
    expectedEffectSummary: ["Výsledek určí server"],
    riskSummary: ["Heat +5"],
    requiresInput: [
      {
        id: "targetCategory",
        type: "select",
        label: "Kategorie marketu",
        required: true,
        options: [
          { value: "chemicals", label: "Chemicals" },
          { value: "electronics", label: "Electronics" }
        ]
      },
      {
        id: "investmentCleanCash",
        type: "number",
        label: "Investice",
        required: true,
        min: 1
      }
    ],
    cooldownRemainingTicks: 0,
    cooldownRemainingMs: 0,
    cooldownMs: 16 * 60 * 1000
  };
  const rawBuilding = {
    buildingId,
    buildingTypeId: "stock_exchange",
    label: "Burza",
    displayName: "Burza",
    level: 1,
    maxLevel: 1,
    status: "active",
    actions: [action]
  };
  const view = {
    districtId: "district:79",
    districtType: "downtown",
    buildings: [{
      buildingId,
      buildingTypeId: "stock_exchange",
      label: "Burza",
      displayName: "Burza",
      detail: {
        typeLabel: "Burza",
        statusLabel: "Aktivní",
        actions: [action],
        specialActions: []
      }
    }]
  };
  const readModel = {
    server: {
      serverInstanceId: "instance:free:test",
      stateVersion: 11
    },
    mode: { tickRateMs: 10_000 },
    player: {
      playerId: "player:1",
      instanceId: "instance:free:test",
      dayNight: { phaseId: "day" },
      resourceBalances: { cash: 20_000, "dirty-cash": 5000 }
    },
    district: {
      districtId: "district:79",
      ownerPlayerId: "player:1",
      isOwnedByPlayer: true,
      intelKnown: true,
      status: "claimed",
      zone: "downtown",
      buildings: [rawBuilding]
    }
  };
  const renderState = {
    districtPanel: {
      districtId: "district:79",
      hasPendingCommand: false,
      buildings: [rawBuilding],
      slots: []
    }
  };
  const dispatchSurfaceAction = vi.fn(async () => ({ accepted: true, readModel }));
  return {
    buildingId,
    dispatchSurfaceAction,
    controller: createServerGameplayBuildingDetailController({
      root: document.querySelector("#game-root"),
      documentRef: document,
      dispatchSurfaceAction,
      getCurrentView: () => view,
      getCurrentReadModel: () => readModel,
      getCurrentRenderState: () => renderState
    })
  };
}

async function waitForConfirmation() {
  await vi.waitFor(() => {
    expect(
      document.querySelector(".building-special-action-confirm:not([hidden])")
    ).not.toBe(null);
  });
  return document.querySelector(".building-special-action-confirm:not([hidden])");
}

function resetOverlayCoordinator() {
  const state = globalThis[Symbol.for("empire.legacyOverlayCoordinator.state")];
  if (!state) return;
  state.overlayStack.splice(0);
  state.suppressionStartedAt = 0;
  state.suppressMapInputUntil = 0;
}
