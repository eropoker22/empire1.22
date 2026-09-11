import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";
import { validateStreetDealersConfig } from "../../../packages/game-config/src/validation/validate-street-dealers-config";

describe("Free mode Street Dealers config", () => {
  it("uses three fixed Lab substances with a 10-unit minimum and complete production costs with a risk premium", () => {
    const config = resolveModeConfig("free");
    const dealers = config.balance.streetDealers!;

    expect(dealers.dealerSlots.map((slot) => slot.itemId)).toEqual([
      "neon-dust",
      "pulse-shot",
      "velvet-smoke"
    ]);
    expect(dealers.sellableDrugs.map((drug) => drug.minimumAmountPerSale)).toEqual([10, 10, 10]);
    expect(dealers.sellableDrugs.map((drug) => drug.unitSalePriceDirtyCash)).toEqual([
      2196, 3492, 3780
    ]);
    validateStreetDealersConfig(config);
  });

  it("rejects an altered strategic slot or a noncanonical minimum", () => {
    const config = resolveModeConfig("free");
    const malformed = {
      ...config,
      balance: {
        ...config.balance,
        streetDealers: {
          ...config.balance.streetDealers!,
          dealerSlots: [
            ...config.balance.streetDealers!.dealerSlots.slice(0, 2),
            { slotId: "slot-3", itemId: "ghost-serum" }
          ]
        }
      }
    };

    expect(() => validateStreetDealersConfig(malformed)).toThrow("velvet-smoke");
  });
});
