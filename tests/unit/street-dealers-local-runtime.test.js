import { describe, expect, it } from "vitest";
import { PARK_DAY_NIGHT_ACTION_RULES, STREET_DEALERS_CONFIG } from "../../packages/game-config/src/legacy-page/economy-config.js";
import {
  createLocalStreetDealerSaleView,
  resolveLocalStreetDealerSlotCount,
  settleLocalStreetDealerSales,
  startLocalStreetDealerSale
} from "../../page-assets/js/app/runtime/streetDealersLocalRuntime.js";

describe("local Street Dealers runtime", () => {
  it("exposes three fixed product slots with prices derived from the Drug Lab", () => {
    for (const ownedCount of [0, 1, 3, 15]) {
      expect(resolveLocalStreetDealerSlotCount(ownedCount, STREET_DEALERS_CONFIG)).toBe(3);
    }

    const view = createLocalStreetDealerSaleView({
      config: STREET_DEALERS_CONFIG,
      ownedCount: 1,
      inventory: { "neon-dust": 10, "pulse-shot": 10, "velvet-smoke": 10 }
    });

    expect(view.slots.map((slot) => [slot.slotId, slot.itemId, slot.unitSalePriceDirtyCash, slot.minimumAmountPerSale])).toEqual([
      ["slot-1", "neon-dust", 625, 10],
      ["slot-2", "pulse-shot", 1000, 10],
      ["slot-3", "velvet-smoke", 1125, 10]
    ]);
    expect(view.slots.map((slot) => slot.label)).toEqual(["Neon Dust", "Pulse Shot", "Velvet Smoke"]);
    expect(view.slots.some((slot) => slot.statusLabel === "Volný")).toBe(false);
  });

  it("requires at least ten fixed-slot units, debits once, and settles one sale", () => {
    const tooSmall = startLocalStreetDealerSale({
      config: STREET_DEALERS_CONFIG,
      ownedCount: 1,
      inventory: { "neon-dust": 10 },
      slotId: "slot-1",
      amount: 9
    });
    expect(tooSmall).toMatchObject({ ok: false, code: "street_dealers_minimum_amount" });

    const started = startLocalStreetDealerSale({
      config: STREET_DEALERS_CONFIG,
      ownedCount: 1,
      inventory: { "neon-dust": 10 },
      slotId: "slot-1",
      itemId: "neon-dust",
      amount: 10,
      phase: "night",
      dayNightRule: PARK_DAY_NIGHT_ACTION_RULES.startDrugSale,
      now: 1_000
    });

    expect(started).toMatchObject({
      ok: true,
      nextInventory: { "neon-dust": 0 },
      sale: { amount: 10, rewardDirtyCash: 6250 }
    });
    const settlement = settleLocalStreetDealerSales(started.nextSaleState, started.sale.completesAt);
    expect(settlement.completed).toEqual([started.sale]);
    expect(settlement.nextSaleState.slots).toEqual([]);
  });

  it("binds each slot to its own product and allows only one sale at a time", () => {
    const started = startLocalStreetDealerSale({
      config: STREET_DEALERS_CONFIG,
      ownedCount: 1,
      inventory: { "neon-dust": 10, "pulse-shot": 10 },
      slotId: "slot-1",
      itemId: "pulse-shot",
      amount: 10,
      now: 1_000
    });
    expect(started).toMatchObject({ ok: false, code: "street_dealers_slot_product_mismatch" });

    const valid = startLocalStreetDealerSale({
      config: STREET_DEALERS_CONFIG,
      ownedCount: 1,
      inventory: { "neon-dust": 10, "pulse-shot": 10 },
      slotId: "slot-1",
      amount: 10,
      now: 1_000
    });
    const blocked = startLocalStreetDealerSale({
      config: STREET_DEALERS_CONFIG,
      ownedCount: 1,
      inventory: valid.nextInventory,
      saleState: valid.nextSaleState,
      slotId: "slot-2",
      amount: 10,
      now: 1_001
    });
    expect(blocked).toMatchObject({ ok: false, code: "street_dealers_sale_active" });
  });

  it("keeps the fixed unit price during daytime while heat and risk may change", () => {
    const day = startLocalStreetDealerSale({
      config: STREET_DEALERS_CONFIG,
      ownedCount: 1,
      inventory: { "neon-dust": 10 },
      slotId: "slot-1",
      amount: 10,
      phase: "day",
      dayNightRule: PARK_DAY_NIGHT_ACTION_RULES.startDrugSale,
      now: 1_000
    });
    expect(day.sale).toMatchObject({ rewardDirtyCash: 6250 });
  });
});
