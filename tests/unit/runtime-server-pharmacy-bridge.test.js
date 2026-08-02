import { describe, expect, it, vi } from "vitest";
import { createProductionBuildingPopupRuntime } from "../../page-assets/js/app/runtime/productionBuildingPopupRuntime.js";

describe("server pharmacy popup bridge", () => {
  it("sends only the pharmacy start intent from server-authored line data", async () => {
    let renderedViewModel = null;
    const renderRecipeCard = vi.fn((viewModel, callbacks) => {
      renderedViewModel = viewModel;
      return { callbacks };
    });
    const submitServerPharmacyCommand = vi.fn(async () => ({ errors: [] }));
    const renderProductionPanelUi = vi.fn(() => true);
    const runtime = createProductionBuildingPopupRuntime({
      allowLegacyLocalProduction: false,
      getServerPharmacyReadModel: () => ({
        districtId: "district:1",
        buildingId: "building:pharmacy:1",
        level: 1,
        lines: [{
          recipeId: "chemicals",
          resourceKey: "chemicals",
          label: "Chemicals",
          producedAmount: 0,
          producedCapacity: 12,
          playerStoredAmount: 7,
          playerStoredCapacity: 60,
          queuedAmount: 0,
          queueCapacity: 8,
          unitCleanCashCost: 360,
          effectiveUnitDurationTicks: 24,
          canStart: true,
          canCancelWaiting: false,
          maxStartQuantity: 3,
          status: "ready"
        }]
      }),
      renderRecipeCard,
      renderProductionPanelUi,
      submitServerPharmacyCommand
    });
    const root = { querySelector: vi.fn(() => ({})) };

    expect(runtime.renderProductionPanel(root, "pharmacy", {}, vi.fn())).toBe(true);
    expect(renderedViewModel).toMatchObject({
      buildingId: "building:pharmacy:1",
      buildingName: "pharmacy",
      recipeId: "chemicals",
      recipe: {
        name: "Chemicals",
        inputs: {},
        cleanMoneyCost: 360,
        output: { inventory: "materials", itemId: "chemicals", amount: 1 }
      },
      job: { status: "ready", queuedAmount: 0, producedAmount: 0 },
      slotState: { label: "Připraveno", isActive: false },
      outputInventoryAmount: 7,
      outputInventoryCapacity: 60,
      outputCap: 12,
      queueCap: 8,
      maxBatches: 3,
      maxSelectableBatches: 3
    });
    expect(renderedViewModel).not.toHaveProperty("serverLine");
    const callbacks = renderRecipeCard.mock.calls[0][1];
    await callbacks.onStart({ batchCount: 2 });
    await callbacks.onStop();

    expect(submitServerPharmacyCommand).toHaveBeenNthCalledWith(1, {
      type: "craft-item",
      payload: {
        districtId: "district:1",
        buildingId: "building:pharmacy:1",
        recipeId: "chemicals",
        quantity: 2
      }
    });
    expect(submitServerPharmacyCommand).toHaveBeenNthCalledWith(2, {
      type: "cancel-pharmacy-production",
      payload: {
        districtId: "district:1",
        buildingId: "building:pharmacy:1",
        recipeId: "chemicals"
      }
    });
    expect(submitServerPharmacyCommand).toHaveBeenCalledTimes(2);
    expect(renderProductionPanelUi).toHaveBeenCalled();
  });
});
