import { describe, expect, it, vi } from "vitest";
import { createProductionBuildingPopupRuntime } from "../../page-assets/js/app/runtime/productionBuildingPopupRuntime.js";

describe("server pharmacy popup bridge", () => {
  it("sends only the pharmacy start intent from server-authored line data", async () => {
    const renderRecipeCard = vi.fn((_viewModel, callbacks) => ({ callbacks }));
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
    const callbacks = renderRecipeCard.mock.calls[0][1];
    await callbacks.onStart({ batchCount: 2 });

    expect(submitServerPharmacyCommand).toHaveBeenCalledWith({
      type: "craft-item",
      payload: {
        districtId: "district:1",
        buildingId: "building:pharmacy:1",
        recipeId: "chemicals",
        quantity: 2
      }
    });
    expect(renderProductionPanelUi).toHaveBeenCalled();
  });
});
