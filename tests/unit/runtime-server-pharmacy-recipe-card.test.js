import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
import { renderServerPharmacyRecipeCard } from "../../page-assets/js/app/ui/serverPharmacyRecipeCard.js";

const createLine = (overrides = {}) => ({
  recipeId: "chemicals",
  resourceKey: "chemicals",
  label: "Chemicals",
  producedAmount: 7,
  producedCapacity: 12,
  queuedAmount: 5,
  queueCapacity: 8,
  unitCleanCashCost: 360,
  effectiveUnitDurationTicks: 24,
  remainingMs: 86_000,
  status: "processing",
  canStart: true,
  canCancelWaiting: true,
  maxStartQuantity: 3,
  disabledReason: null,
  ...overrides
});

describe("server pharmacy recipe card", () => {
  it("renders only the four pharmacy metrics from the server line", () => {
    const dom = new JSDOM("<body></body>");
    const start = vi.fn();
    const card = renderServerPharmacyRecipeCard({
      buildingName: "pharmacy",
      serverLine: createLine(),
      tickRateMs: 5000,
      visual: { slotClass: "pharmacy-slot--cyan" }
    }, { onStart: start }, {
      mount: dom.window.document.body,
      formatCurrency: (value) => "$" + value
    });

    expect(card.querySelectorAll(".pharmacy-slot__metric")).toHaveLength(4);
    expect(card.textContent).toContain("Vyrobeno7/12 ks");
    expect(card.textContent).toContain("Ve frontě5/8 ks");
    expect(card.textContent).toContain("Cena$360 clean");
    expect(card.textContent).not.toContain("Ve skladu");
    card.querySelector(".pharmacy-slot__btn--start").click();
    expect(start).toHaveBeenCalledWith(expect.objectContaining({ batchCount: 1 }));
  });

  it("keeps controls disabled from the server state and shows over-capacity-safe values", () => {
    const dom = new JSDOM("<body></body>");
    const card = renderServerPharmacyRecipeCard({
      buildingName: "pharmacy",
      serverLine: createLine({
        producedAmount: 13,
        producedCapacity: 12,
        queuedAmount: 4,
        status: "full",
        canStart: false,
        canCancelWaiting: false,
        maxStartQuantity: 0
      })
    }, {}, { mount: dom.window.document.body });

    expect(card.textContent).toContain("13/12 ks");
    expect(card.textContent).toContain("Plná kapacita");
    expect(card.querySelector(".pharmacy-slot__btn--start").disabled).toBe(true);
    expect(card.querySelector(".pharmacy-slot__btn--stop").disabled).toBe(true);
  });
});
