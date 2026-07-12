import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
import { renderServerDrugLabRecipeCard } from "../../page-assets/js/app/ui/serverDrugLabRecipeCard.js";
import { createProductionBuildingPopupRuntime } from "../../page-assets/js/app/runtime/productionBuildingPopupRuntime.js";
import { usePharmacyBoost } from "../../page-assets/js/app/runtime.js";

const line = (overrides = {}) => ({
  recipeId: "ghost-serum",
  resourceKey: "ghost-serum",
  label: "Ghost Serum",
  description: "Vzácná laboratorní komponenta určená pro budoucí výrobu specializovaných boostů.",
  itemRole: "boost-component",
  producedAmount: 1,
  producedCapacity: 2,
  playerStoredAmount: 7,
  playerStoredCapacity: 8,
  queuedAmount: 2,
  queueCapacity: 2,
  unitCleanCashCost: 2500,
  inputAvailability: [
    { resourceKey: "neon-dust", label: "Neon Dust", requiredAmount: 2, availableAmount: 4 },
    { resourceKey: "pulse-shot", label: "Pulse Shot", requiredAmount: 1, availableAmount: 2 }
  ],
  effectiveUnitDurationTicks: 240,
  remainingMs: 120_000,
  status: "processing",
  canStart: true,
  canCancelWaiting: true,
  maxStartQuantity: 1,
  disabledReason: null,
  ...overrides
});

describe("server drug lab recipe card", () => {
  it("treats Ghost Serum and Overdrive X as non-activatable components", () => {
    expect(usePharmacyBoost("recon")).toMatchObject({
      ok: false,
      code: "item_not_directly_usable"
    });
  });

  it("renders the existing Lab layout from server data with three input chips and no use action", () => {
    const dom = new JSDOM("<body></body>");
    const start = vi.fn();
    const card = renderServerDrugLabRecipeCard({
      buildingName: "druglab",
      serverLine: line(),
      cleanCashAmount: 8400,
      tickRateMs: 5000
    }, { onStart: start }, {
      mount: dom.window.document.body,
      formatCurrency: (value) => "$" + value
    });

    expect(card.querySelectorAll(".drug-production-slot__metric")).toHaveLength(5);
    expect(card.querySelectorAll(".drug-production-slot__supply-pill")).toHaveLength(3);
    expect(card.textContent).toContain("Vyrobeno1/2 ks");
    expect(card.textContent).toContain("Ve skladu7/8 ks");
    expect(card.textContent).toContain("Clean Cash2500/8400");
    expect(card.textContent).not.toContain("Použít");
    expect(card.textContent).not.toContain("Aktivovat");
    card.querySelector(".drug-lab-mini-btn").click();
    expect(start).toHaveBeenCalledWith(expect.objectContaining({ batchCount: 1 }));
  });

  it("submits only the Lab server intent and its cancel command", async () => {
    const renderRecipeCard = vi.fn((_viewModel, callbacks) => ({ callbacks }));
    const submitServerDrugLabCommand = vi.fn(async () => ({ errors: [] }));
    const runtime = createProductionBuildingPopupRuntime({
      allowLegacyLocalProduction: false,
      getServerDrugLabReadModel: () => ({
        districtId: "district:1",
        buildingId: "building:drug-lab:1",
        level: 1,
        cleanCashAmount: 8400,
        lines: [line()]
      }),
      renderRecipeCard,
      renderProductionPanelUi: vi.fn(() => true),
      submitServerDrugLabCommand
    });
    const root = { querySelector: vi.fn(() => ({})) };

    expect(runtime.renderProductionPanel(root, "druglab", {}, vi.fn())).toBe(true);
    const callbacks = renderRecipeCard.mock.calls[0][1];
    await callbacks.onStart({ batchCount: 1 });
    await callbacks.onStop({});

    expect(submitServerDrugLabCommand).toHaveBeenNthCalledWith(1, {
      type: "craft-item",
      payload: { districtId: "district:1", buildingId: "building:drug-lab:1", recipeId: "ghost-serum", quantity: 1 }
    });
    expect(submitServerDrugLabCommand).toHaveBeenNthCalledWith(2, {
      type: "cancel-drug-lab-production",
      payload: { districtId: "district:1", buildingId: "building:drug-lab:1", recipeId: "ghost-serum" }
    });
  });
});
